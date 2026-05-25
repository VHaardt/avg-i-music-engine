import asyncio
import json
import queue as stdlib_queue
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.graph import build_graph
from backend.logger import logger
from backend.midi_service import get_midi_service
from backend.state import MusicState, create_initial_state

app = FastAPI(title="Music Multi-Agent System")
GRAPH = build_graph()
STRUDEL_FILE = Path(__file__).parent.parent / ".strudel"
logger.info("Backend avviato — grafo LangGraph compilato")

_sessions: dict[str, MusicState] = {}


def _write_strudel_file(code: str) -> None:
    STRUDEL_FILE.write_text(code, encoding="utf-8")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/midi/ports")
def midi_ports():
    return {"ports": get_midi_service().get_ports()}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    _sessions[session_id] = create_initial_state()
    await websocket.send_json({"type": "connected"})
    logger.info(f"WebSocket connesso [session={session_id}]")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("[ws] messaggio malformato ignorato")
                continue
            state = _sessions[session_id]

            msg_type = msg.get("type")
            if msg_type == "runtime_error":
                error_msg = msg.get("message", "")
                logger.warning(f"[ws] runtime_error from browser: {error_msg!r}")
                if not error_msg:
                    continue
                state["last_runtime_error"] = error_msg
                state["user_intent"] = "runtime_error"
                state["conversation_history"] = state["conversation_history"] + [{
                    "role": "user",
                    "content": f"[RUNTIME_ERROR] {error_msg}",
                }]
                # Fall through to graph invocation
            elif msg_type == "user_message":
                content = msg.get("message", "")
                current_code = msg.get("current_code", "")
                manually_edited = msg.get("manually_edited", False)
                logger.info(f"[ws] user_message: {content!r} (manually_edited={manually_edited})")
                if current_code:
                    state["strudel_code"] = current_code
                if manually_edited and current_code:
                    state["conversation_history"] = state["conversation_history"] + [{
                        "role": "system",
                        "content": f"[CONTEXT] L'utente ha modificato manualmente il codice prima di inviare questo messaggio. Codice attuale:\n{current_code}",
                    }]
                state["conversation_history"] = state["conversation_history"] + [
                    {"role": "user", "content": content}
                ]
            elif msg_type == "knob_change":
                logger.info(f"[ws] knob_change: {msg.get('knob_name')}={msg.get('value')}")
                state["conversation_history"] = state["conversation_history"] + [
                    {"role": "user", "content": f"[KNOB] {msg.get('knob_name')}={msg.get('value')}"}
                ]
            elif msg_type == "midi_config":
                enabled = msg.get("enabled", False)
                port = msg.get("port_index", 0)
                svc = get_midi_service()
                if enabled:
                    svc.start(port_index=int(port), bpm=state.get("musical_context", {}).get("bpm", 120))
                    await websocket.send_json({"type": "midi_status", "connected": True, "port": port})
                else:
                    svc.stop()
                    await websocket.send_json({"type": "midi_status", "connected": False, "port": ""})
                continue
            else:
                logger.warning(f"[ws] tipo messaggio sconosciuto: {msg_type!r}")
                continue

            try:
                logger.info("[ws] invocazione grafo LangGraph...")

                stream_q: stdlib_queue.Queue = stdlib_queue.Queue()
                loop = asyncio.get_running_loop()

                async def _drain_stream() -> None:
                    while True:
                        try:
                            chunk = stream_q.get_nowait()
                            await websocket.send_json({"type": "stream_chunk", "text": chunk})
                        except stdlib_queue.Empty:
                            await asyncio.sleep(0.02)

                graph_config = {"configurable": {"stream_queue": stream_q}}

                drain_task = asyncio.create_task(_drain_stream())
                try:
                    result = await loop.run_in_executor(
                        None,
                        lambda: GRAPH.invoke(state, config=graph_config),
                    )
                finally:
                    drain_task.cancel()

                # Flush remaining chunks
                while not stream_q.empty():
                    chunk = stream_q.get_nowait()
                    await websocket.send_json({"type": "stream_chunk", "text": chunk})

                _sessions[session_id] = result
                new_bpm = result.get("musical_context", {}).get("bpm")
                if new_bpm:
                    get_midi_service().set_bpm(float(new_bpm))
                code_error = result.get("code_error", "")
                logger.info(f"[ws] grafo completato — code_error={code_error!r}")

                if result.get("strudel_code"):
                    _write_strudel_file(result["strudel_code"])

                await websocket.send_json({
                    "type": "update",
                    "code": result.get("strudel_code", ""),
                    "knobs": result.get("active_knobs", []),
                    "message": result.get("agent_message", ""),
                    "creative_mode": result.get("creative_mode", False),
                    "code_error": code_error,
                })
            except Exception as exc:
                logger.error(f"[ws] errore grafo: {exc}")
                await websocket.send_json({
                    "type": "update",
                    "code": state.get("strudel_code", ""),
                    "knobs": state.get("active_knobs", []),
                    "message": f"⚠️ Errore interno: {exc}. Riprova.",
                    "creative_mode": False,
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnesso [session={session_id}]")
        _sessions.pop(session_id, None)
