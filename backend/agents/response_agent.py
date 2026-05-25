import json
import os
import queue as stdlib_queue
from pathlib import Path
from typing import Optional

from backend.config_loader import get_model as _get_model
from backend.llm_utils import llm_call, llm_stream
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "response_agent.yaml"


def response_agent(state: MusicState, config: Optional[dict] = None) -> dict:
    logger.info("[response_agent] generazione risposta")

    stream_q: Optional[stdlib_queue.Queue] = None
    if config:
        stream_q = config.get("configurable", {}).get("stream_queue")

    prompt = load_prompt(str(PROMPT_PATH))
    history = state.get("conversation_history", [])

    last_user = next(
        (m["content"] for m in reversed(history) if m.get("role") == "user"), ""
    )

    system = interpolate_prompt(prompt["system"], {
        "language": os.environ.get("RESPONSE_LANGUAGE", "Italian"),
        "creative_mode": str(state["creative_mode"]),
        "creative_suggestions": json.dumps(state.get("creative_suggestions", [])),
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_user,
        "musical_context": json.dumps(state["musical_context"]),
        "has_new_code": "yes" if state["strudel_code"] else "no",
        "strudel_code": state.get("strudel_code", ""),
    })

    messages: list[dict] = [{"role": "system", "content": system}]
    for entry in history:
        role = entry.get("role", "")
        content = entry.get("content", "")
        if role == "system":
            messages.append({"role": "user", "content": content})
            messages.append({"role": "assistant", "content": "Capito."})
        elif role == "user" and content != last_user:
            messages.append({"role": "user", "content": content})
        elif role == "agent":
            messages.append({"role": "assistant", "content": content})
    messages.append({"role": "user", "content": user})

    call_kwargs = dict(model=_get_model(), messages=messages, temperature=0.7)

    if stream_q is not None:
        chunks: list[str] = []
        for chunk in llm_stream("response_agent", **call_kwargs):
            stream_q.put(chunk)
            chunks.append(chunk)
        message = "".join(chunks).strip()
    else:
        response = llm_call("response_agent", **call_kwargs)
        message = response.choices[0].message.content.strip()

    logger.info(f"[response_agent] risposta: {message[:80]!r}{'...' if len(message) > 80 else ''}")
    state["conversation_history"].append({"role": "agent", "content": message})
    return {"agent_message": message}
