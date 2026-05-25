# Sprint 1 — AI Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'AI non inventa sample inesistenti, si autocorregge sugli errori Strudel runtime, e mostra le risposte in streaming invece di farle apparire tutte insieme.

**Architecture:** (1) `SampleRegistry` inietta una lista di sample validi nel prompt di `strudel_coder`. (2) `error_recovery_agent` è un nuovo nodo LangGraph attivato direttamente da `main.py` quando arriva un `runtime_error` WebSocket — bypassa il supervisor via conditional edge su START. (3) `response_agent` usa `litellm.completion(stream=True)` e invia chunks via una `asyncio.Queue` thread-safe; `main.py` li drena e li manda al frontend come `{ type: "stream_chunk" }` frames.

**Tech Stack:** Python 3.11, litellm, LangGraph, FastAPI WebSocket, React + TypeScript, Vitest

---

## File Map

```
backend/
  sample_registry.py                    NEW  — lista hardcoded GM soundfonts + SuperDirt
  agents/error_recovery_agent.py        NEW  — patcha codice Strudel rotto
  prompts/error_recovery_agent.yaml     NEW  — prompt per error recovery
  llm_utils.py                          MOD  — aggiunge llm_stream() generator
  agents/strudel_coder.py               MOD  — inietta available_samples nel system prompt
  prompts/strudel_coder.yaml            MOD  — aggiunge placeholder {available_samples}
  agents/response_agent.py              MOD  — usa llm_stream() se stream_callback presente
  graph.py                              MOD  — entry conditional edge + error_recovery node
  main.py                               MOD  — runtime_error invoca grafo; drain stream_q

frontend/src/
  types.ts                              MOD  — aggiunge StreamChunkMessage
  hooks/useWebSocket.ts                 MOD  — gestisce stream_chunk, espone streamingText
  components/Chat.tsx                   MOD  — mostra streamingText in-progress

tests/
  test_sample_registry.py               NEW
  test_error_recovery_agent.py          NEW
  test_graph.py                         MOD  — aggiunge test routing runtime_error
```

---

## Task 1: SampleRegistry

**Files:**
- Create: `backend/sample_registry.py`
- Create: `tests/test_sample_registry.py`

- [ ] **Step 1.1: Scrivi il test**

```python
# tests/test_sample_registry.py
from backend.sample_registry import get_sample_context, SUPERDIRT_SAMPLES, GM_SOUNDFONTS


def test_get_sample_context_returns_string():
    ctx = get_sample_context()
    assert isinstance(ctx, str)
    assert len(ctx) > 10


def test_get_sample_context_contains_common_samples():
    ctx = get_sample_context()
    for name in ["bd", "sn", "hh", "piano", "bass"]:
        assert name in ctx, f"'{name}' missing from sample context"


def test_superdirt_samples_not_empty():
    assert len(SUPERDIRT_SAMPLES) >= 20


def test_gm_soundfonts_not_empty():
    assert len(GM_SOUNDFONTS) >= 10


def test_no_duplicates():
    all_samples = SUPERDIRT_SAMPLES + GM_SOUNDFONTS
    assert len(all_samples) == len(set(all_samples))
```

- [ ] **Step 1.2: Esegui il test — deve FALLIRE**

```bash
cd /Users/vitto/Desktop/music && source backend/.venv/bin/activate && pytest tests/test_sample_registry.py -v
```
Expected: `ModuleNotFoundError: No module named 'backend.sample_registry'`

- [ ] **Step 1.3: Implementa `backend/sample_registry.py`**

```python
# backend/sample_registry.py
SUPERDIRT_SAMPLES: list[str] = [
    "bd", "sn", "hh", "oh", "cp", "rim", "mt", "ht", "lt", "cy",
    "cr", "cb", "808", "808bd", "808sd", "808hc", "808oh",
    "bass", "bass0", "bass1", "bass2", "bass3",
    "arpy", "arp", "feel", "gtr", "gab", "amencutup",
    "bev", "bin", "birds", "bleep", "blip", "bottle",
    "breaks125", "breaks152", "breaks157", "breaks165",
    "breath", "bubble", "can", "casio", "chin", "circus",
    "clap", "click", "clubkick", "co", "coins", "control",
    "cosmicg", "crap", "crow", "db", "diphone", "diphone2",
    "dist", "dork2", "dub", "dubkick", "e", "east",
    "electro1", "em2", "erk", "f", "feel", "feelfx",
    "fest", "fire", "flick", "fm", "frog", "future",
    "gabba", "gabbalouder", "glasstap", "glitch", "glitch2",
    "gretsch", "h", "hand", "hardcore", "hardkick", "haw",
    "ho", "hoover", "house", "ht", "if", "ifdrums",
    "incoming", "industrial", "insect", "invaders",
    "jazz", "jungbass", "jungle", "jvbass", "koy",
    "kurt", "latibro", "led", "less", "lighter",
    "lt", "made", "made2", "mash", "mash2", "metal",
    "miniyeah", "monsterb", "moog", "mouth", "mp3",
    "multibass", "noise", "noise2", "notes", "newnotes",
    "off", "pad", "padlong", "pebbles", "perc", "perc2",
    "popkick", "print", "proc", "procshort", "psr",
    "rave", "rave2", "ravemono", "realclaps", "reverbkick",
    "rm", "rollingsnare", "rs", "sd", "seawolf",
    "sequential", "sf", "sheffield", "short", "sid",
    "sine", "sitar", "space", "speakspell", "speech",
    "speechless", "speedupvibes", "stab", "stomp",
    "stopmyinput", "subroc3d", "sundance", "tabla", "tabla2",
    "tablex", "tacscan", "tech", "techno", "tink", "tok",
    "toys", "trump", "ul", "ulgab", "uxay", "v",
    "voodoo", "wind", "wobble", "worm", "xmas", "yeah",
]

GM_SOUNDFONTS: list[str] = [
    "piano", "bright-acoustic-piano", "electric-grand-piano",
    "honky-tonk-piano", "electric-piano-1", "electric-piano-2",
    "harpsichord", "clavi",
    "celesta", "glockenspiel", "music-box", "vibraphone",
    "marimba", "xylophone", "tubular-bells", "dulcimer",
    "drawbar-organ", "percussive-organ", "rock-organ", "church-organ",
    "reed-organ", "accordion", "harmonica", "tango-accordion",
    "acoustic-guitar-nylon", "acoustic-guitar-steel",
    "electric-guitar-jazz", "electric-guitar-clean",
    "electric-guitar-muted", "overdriven-guitar", "distortion-guitar",
    "guitar-harmonics",
    "acoustic-bass", "electric-bass-finger", "electric-bass-pick",
    "fretless-bass", "slap-bass-1", "slap-bass-2",
    "synth-bass-1", "synth-bass-2",
    "violin", "viola", "cello", "contrabass",
    "tremolo-strings", "pizzicato-strings", "orchestral-harp", "timpani",
    "string-ensemble-1", "string-ensemble-2",
    "synth-strings-1", "synth-strings-2",
    "choir-aahs", "voice-oohs", "synth-voice", "orchestra-hit",
    "trumpet", "trombone", "tuba", "muted-trumpet",
    "french-horn", "brass-section", "synth-brass-1", "synth-brass-2",
    "soprano-sax", "alto-sax", "tenor-sax", "baritone-sax",
    "oboe", "english-horn", "bassoon", "clarinet",
    "piccolo", "flute", "recorder", "pan-flute",
    "blown-bottle", "shakuhachi", "whistle", "ocarina",
    "lead-1-square", "lead-2-sawtooth", "lead-3-calliope",
    "lead-4-chiff", "lead-5-charang", "lead-6-voice",
    "lead-7-fifths", "lead-8-bass-lead",
    "pad-1-new-age", "pad-2-warm", "pad-3-polysynth",
    "pad-4-choir", "pad-5-bowed", "pad-6-metallic",
    "pad-7-halo", "pad-8-sweep",
    "fx-1-rain", "fx-2-soundtrack", "fx-3-crystal",
    "fx-4-atmosphere", "fx-5-brightness", "fx-6-goblins",
    "fx-7-echoes", "fx-8-sci-fi",
    "sitar", "banjo", "shamisen", "koto", "kalimba",
    "bag-pipe", "fiddle", "shanai",
    "tinkle-bell", "agogo", "steel-drums", "woodblock",
    "taiko-drum", "melodic-tom", "synth-drum", "reverse-cymbal",
    "guitar-fret-noise", "breath-noise", "seashore",
    "bird-tweet", "telephone-ring", "helicopter", "applause", "gunshot",
]


def get_sample_context() -> str:
    superdirt = " ".join(SUPERDIRT_SAMPLES)
    gm = " ".join(GM_SOUNDFONTS)
    return (
        f"SuperDirt/Dirt-Samples (use with s() or sound()): {superdirt}\n"
        f"GM Soundfonts (use with note().s() or s()): {gm}"
    )
```

- [ ] **Step 1.4: Esegui il test — deve PASSARE**

```bash
pytest tests/test_sample_registry.py -v
```
Expected: `4 passed`

- [ ] **Step 1.5: Commit**

```bash
git add backend/sample_registry.py tests/test_sample_registry.py
git commit -m "feat: add SampleRegistry with GM soundfonts and SuperDirt sample list"
```

---

## Task 2: Inietta sample context in strudel_coder

**Files:**
- Modify: `backend/prompts/strudel_coder.yaml`
- Modify: `backend/agents/strudel_coder.py`
- Modify: `tests/test_strudel_coder.py`

- [ ] **Step 2.1: Aggiungi test al file esistente**

Apri `tests/test_strudel_coder.py` e aggiungi in fondo:

```python
def test_strudel_coder_includes_available_samples_in_prompt(mocker):
    """System prompt must mention available samples so AI stops inventing them."""
    from backend.agents.strudel_coder import strudel_coder_agent
    from backend.state import create_initial_state

    captured_messages = []

    def fake_llm_call(agent, **kwargs):
        captured_messages.extend(kwargs.get("messages", []))
        from unittest.mock import MagicMock
        m = MagicMock()
        m.choices[0].message.content = "```javascript\nnote('c3').s('piano')\n```"
        return m

    mocker.patch("backend.agents.strudel_coder.llm_call", side_effect=fake_llm_call)

    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "make a piano note"}]
    strudel_coder_agent(state)

    system_content = next(m["content"] for m in captured_messages if m["role"] == "system")
    assert "piano" in system_content
    assert "bd" in system_content
```

- [ ] **Step 2.2: Esegui il test — deve FALLIRE**

```bash
pytest tests/test_strudel_coder.py::test_strudel_coder_includes_available_samples_in_prompt -v
```
Expected: `AssertionError` (piano/bd non nel system prompt)

- [ ] **Step 2.3: Aggiungi `{available_samples}` al system prompt YAML**

Apri `backend/prompts/strudel_coder.yaml`. Trova l'inizio della sezione `system: |` e aggiungi il blocco `<available_samples>` alla fine della parte di role/context, prima delle regole. Cerca la riga che inizia con `<rules>` o `<constraints>` (la prima sezione di regole) e inserisci prima di essa:

```yaml
  <available_samples>
  Only use sample names from this list. Never invent sample names.
  {available_samples}
  </available_samples>
```

- [ ] **Step 2.4: Inietta il context in `strudel_coder_agent()`**

In `backend/agents/strudel_coder.py`, alla riga che fa `interpolate_prompt(prompt["system"], {...})`, aggiungi `"available_samples"` al dizionario:

```python
from backend.sample_registry import get_sample_context

# Modifica la chiamata interpolate_prompt nel system:
system = interpolate_prompt(prompt["system"], {
    "strudel_code": state["strudel_code"] or "// empty",
    "musical_context": json.dumps(state["musical_context"]),
    "knob_change": knob_change,
    "available_samples": get_sample_context(),   # ← aggiunto
})
```

- [ ] **Step 2.5: Esegui il test — deve PASSARE**

```bash
pytest tests/test_strudel_coder.py -v
```
Expected: tutti i test passano, incluso il nuovo.

- [ ] **Step 2.6: Commit**

```bash
git add backend/sample_registry.py backend/agents/strudel_coder.py backend/prompts/strudel_coder.yaml tests/test_strudel_coder.py
git commit -m "feat: inject available sample list into strudel_coder system prompt"
```

---

## Task 3: Error Recovery Agent

**Files:**
- Create: `backend/agents/error_recovery_agent.py`
- Create: `backend/prompts/error_recovery_agent.yaml`
- Create: `tests/test_error_recovery_agent.py`

- [ ] **Step 3.1: Scrivi i test**

```python
# tests/test_error_recovery_agent.py
from unittest.mock import MagicMock


def _make_response(content: str):
    m = MagicMock()
    m.choices[0].message.content = content
    return m


def test_error_recovery_returns_fixed_code(mocker):
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    mocker.patch(
        "backend.agents.error_recovery_agent.llm_call",
        return_value=_make_response("```javascript\nnote('c3').s('piano')\n```"),
    )

    state = create_initial_state()
    state["strudel_code"] = "note('c3').s('nonexistent_sample_xyz')"
    state["last_runtime_error"] = "Unknown sample: nonexistent_sample_xyz"
    state["conversation_history"] = [
        {"role": "user", "content": "make a piano note"}
    ]

    result = error_recovery_agent(state)

    assert "strudel_code" in result
    assert result["strudel_code"] == "note('c3').s('piano')"


def test_error_recovery_receives_error_in_prompt(mocker):
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    captured = []

    def fake_llm(agent, **kwargs):
        captured.extend(kwargs.get("messages", []))
        return _make_response("```javascript\nnote('c3')\n```")

    mocker.patch("backend.agents.error_recovery_agent.llm_call", side_effect=fake_llm)

    state = create_initial_state()
    state["strudel_code"] = "broken_code()"
    state["last_runtime_error"] = "ReferenceError: broken_code is not defined"
    state["conversation_history"] = [{"role": "user", "content": "test"}]

    error_recovery_agent(state)

    user_msg = next(m["content"] for m in captured if m["role"] == "user")
    assert "ReferenceError" in user_msg
    assert "broken_code" in user_msg


def test_error_recovery_clears_runtime_error(mocker):
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    mocker.patch(
        "backend.agents.error_recovery_agent.llm_call",
        return_value=_make_response("```javascript\nnote('c3')\n```"),
    )

    state = create_initial_state()
    state["strudel_code"] = "bad()"
    state["last_runtime_error"] = "some error"
    state["conversation_history"] = [{"role": "user", "content": "x"}]

    result = error_recovery_agent(state)
    assert result.get("last_runtime_error") == ""
```

- [ ] **Step 3.2: Esegui i test — devono FALLIRE**

```bash
pytest tests/test_error_recovery_agent.py -v
```
Expected: `ModuleNotFoundError: No module named 'backend.agents.error_recovery_agent'`

- [ ] **Step 3.3: Crea il prompt YAML**

```yaml
# backend/prompts/error_recovery_agent.yaml
system: |
  <role>
  You are a Strudel code repair agent. The browser executed Strudel code and got
  a runtime error. Your ONLY job is to fix the broken code with a minimal surgical patch.
  </role>

  <rules>
  1. Fix ONLY the part that caused the error — do not rewrite the whole pattern.
  2. Never use sample names that are not standard SuperDirt or GM soundfonts.
  3. Output ONLY the corrected JavaScript/Strudel code inside a fenced code block.
  4. Do not explain, apologize, or add comments.
  5. If the error is unfixable (e.g. unsupported API), replace the broken expression
     with a simple working fallback like note('c3').s('piano').
  </rules>

  <current_code>
  {strudel_code}
  </current_code>

user: |
  RUNTIME ERROR: {error_message}

  Fix the code above so this error no longer occurs.
  Output only the corrected code block.
```

- [ ] **Step 3.4: Implementa `error_recovery_agent.py`**

```python
# backend/agents/error_recovery_agent.py
from pathlib import Path

from backend.config_loader import get_model as _get_model
from backend.json_utils import extract_code
from backend.llm_utils import llm_call
from backend.logger import logger
from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "error_recovery_agent.yaml"


def error_recovery_agent(state: MusicState) -> dict:
    error = state.get("last_runtime_error", "")
    logger.info(f"[error_recovery] fixing runtime error: {error!r}")

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state.get("strudel_code") or "// empty",
    })
    user = interpolate_prompt(prompt["user"], {
        "error_message": error,
    })

    last_user = next(
        (m["content"] for m in reversed(state.get("conversation_history", []))
         if m.get("role") == "user"),
        "",
    )
    if last_user:
        user = f'ORIGINAL USER REQUEST: "{last_user}"\n\n{user}'

    response = llm_call(
        "error_recovery_agent",
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )

    raw = response.choices[0].message.content
    fixed_code = extract_code(raw) or state.get("strudel_code", "")
    logger.info(f"[error_recovery] fixed code: {fixed_code[:80]!r}")

    return {
        "strudel_code": fixed_code,
        "last_runtime_error": "",
    }
```

- [ ] **Step 3.5: Esegui i test — devono PASSARE**

```bash
pytest tests/test_error_recovery_agent.py -v
```
Expected: `3 passed`

- [ ] **Step 3.6: Commit**

```bash
git add backend/agents/error_recovery_agent.py backend/prompts/error_recovery_agent.yaml tests/test_error_recovery_agent.py
git commit -m "feat: add error_recovery_agent for auto-patching Strudel runtime errors"
```

---

## Task 4: Wiring nel grafo + main.py

**Files:**
- Modify: `backend/graph.py`
- Modify: `backend/main.py`
- Modify: `tests/test_graph.py`

- [ ] **Step 4.1: Aggiungi test al test_graph.py**

Apri `tests/test_graph.py` e aggiungi:

```python
def test_runtime_error_routes_to_error_recovery(mocker):
    """When user_intent is pre-set to runtime_error, graph bypasses supervisor."""
    from backend.graph import build_graph
    from backend.state import create_initial_state

    # Mock all agents to avoid real LLM calls
    mocker.patch("backend.agents.supervisor.llm_call")
    recovery_mock = mocker.patch(
        "backend.agents.error_recovery_agent.llm_call",
        return_value=_make_response("```javascript\nnote('c3')\n```"),
    )
    mocker.patch(
        "backend.agents.response_agent.llm_call",
        return_value=_make_response("Fixed!"),
    )

    graph = build_graph()
    state = create_initial_state()
    state["strudel_code"] = "broken()"
    state["last_runtime_error"] = "broken is not defined"
    state["user_intent"] = "runtime_error"
    state["conversation_history"] = [{"role": "user", "content": "[RUNTIME_ERROR] broken is not defined"}]

    result = graph.invoke(state)

    assert recovery_mock.called, "error_recovery_agent must be called"
    assert result.get("last_runtime_error") == ""
```

Nota: se `_make_response` non è già definita in `test_graph.py`, aggiungila in cima al file:
```python
from unittest.mock import MagicMock

def _make_response(content: str):
    m = MagicMock()
    m.choices[0].message.content = content
    return m
```

- [ ] **Step 4.2: Esegui il test — deve FALLIRE**

```bash
pytest tests/test_graph.py::test_runtime_error_routes_to_error_recovery -v
```
Expected: `AssertionError: error_recovery_agent must be called`

- [ ] **Step 4.3: Modifica `backend/graph.py`**

Aggiungi il nodo `error_recovery_agent` e sostituisci `add_edge(START, "supervisor")` con un conditional edge:

```python
# backend/graph.py
from langgraph.graph import END, START, StateGraph

from backend.agents.creative_agent import creative_agent
from backend.agents.error_recovery_agent import error_recovery_agent
from backend.agents.knobs_agent import knobs_agent
from backend.agents.music_expert import music_expert_agent
from backend.agents.response_agent import response_agent
from backend.agents.strudel_coder import strudel_coder_agent
from backend.agents.supervisor import supervisor_agent
from backend.state import MusicState


def _entry_route(state: MusicState) -> str:
    if state.get("user_intent") == "runtime_error":
        return "error_recovery_agent"
    return "supervisor"


def _route_from_supervisor(state: MusicState) -> str:
    first = (state.get("next_agents") or ["response_agent"])[0]
    valid = {"music_expert", "creative_agent", "strudel_coder", "response_agent"}
    return first if first in valid else "response_agent"


def _route_from_music_expert(state: MusicState) -> str:
    agents = state.get("next_agents", [])
    return "strudel_coder" if "strudel_coder" in agents else "response_agent"


def _route_from_creative(state: MusicState) -> str:
    agents = state.get("next_agents", [])
    return "strudel_coder" if "strudel_coder" in agents else "response_agent"


def build_graph() -> StateGraph:
    g = StateGraph(MusicState)

    g.add_node("supervisor", supervisor_agent)
    g.add_node("music_expert", music_expert_agent)
    g.add_node("creative_agent", creative_agent)
    g.add_node("strudel_coder", strudel_coder_agent)
    g.add_node("knobs_agent", knobs_agent)
    g.add_node("response_agent", response_agent)
    g.add_node("error_recovery_agent", error_recovery_agent)

    g.add_conditional_edges(START, _entry_route, {
        "supervisor": "supervisor",
        "error_recovery_agent": "error_recovery_agent",
    })

    g.add_conditional_edges("supervisor", _route_from_supervisor, {
        "music_expert": "music_expert",
        "creative_agent": "creative_agent",
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_conditional_edges("music_expert", _route_from_music_expert, {
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_conditional_edges("creative_agent", _route_from_creative, {
        "strudel_coder": "strudel_coder",
        "response_agent": "knobs_agent",
    })
    g.add_edge("strudel_coder", "knobs_agent")
    g.add_edge("knobs_agent", "response_agent")
    g.add_edge("error_recovery_agent", "response_agent")
    g.add_edge("response_agent", END)

    return g.compile()
```

- [ ] **Step 4.4: Modifica `backend/main.py` — gestione runtime_error**

Trova il blocco `if msg_type == "runtime_error":` in `websocket_endpoint` e sostituiscilo:

```python
if msg_type == "runtime_error":
    error_msg = msg.get("message", "")
    logger.warning(f"[ws] runtime_error from browser: {error_msg!r}")
    if not error_msg:
        continue
    # Pre-set routing so graph bypasses supervisor
    state["last_runtime_error"] = error_msg
    state["user_intent"] = "runtime_error"
    state["conversation_history"] = state["conversation_history"] + [{
        "role": "user",
        "content": f"[RUNTIME_ERROR] {error_msg}",
    }]
    # Fall through to graph invocation (no continue)
```

Rimuovi il `continue` che era presente nella versione precedente del blocco.

- [ ] **Step 4.5: Esegui i test — devono PASSARE**

```bash
pytest tests/test_graph.py -v
```
Expected: tutti i test passano incluso il nuovo.

- [ ] **Step 4.6: Commit**

```bash
git add backend/graph.py backend/main.py tests/test_graph.py
git commit -m "feat: wire error_recovery_agent into graph with runtime_error bypass routing"
```

---

## Task 5: Streaming LLM + response_agent + main.py drain

**Files:**
- Modify: `backend/llm_utils.py`
- Modify: `backend/agents/response_agent.py`
- Modify: `backend/main.py`
- Modify: `tests/test_llm_utils.py`

- [ ] **Step 5.1: Scrivi test per `llm_stream`**

Apri `tests/test_llm_utils.py` e aggiungi:

```python
def test_llm_stream_yields_text_chunks(mocker):
    from backend.llm_utils import llm_stream
    from unittest.mock import MagicMock, patch

    chunk1 = MagicMock()
    chunk1.choices[0].delta.content = "Hello"
    chunk2 = MagicMock()
    chunk2.choices[0].delta.content = " world"
    chunk3 = MagicMock()
    chunk3.choices[0].delta.content = None  # litellm emits None on final chunk

    with patch("backend.llm_utils.litellm") as mock_litellm:
        mock_litellm.completion.return_value = iter([chunk1, chunk2, chunk3])
        result = list(llm_stream("test_agent", model="fake-model", messages=[]))

    assert result == ["Hello", " world"]


def test_llm_stream_passes_stream_true(mocker):
    from backend.llm_utils import llm_stream
    from unittest.mock import patch

    with patch("backend.llm_utils.litellm") as mock_litellm:
        mock_litellm.completion.return_value = iter([])
        list(llm_stream("test_agent", model="fake-model", messages=[{"role": "user", "content": "x"}]))

    call_kwargs = mock_litellm.completion.call_args[1]
    assert call_kwargs.get("stream") is True
```

- [ ] **Step 5.2: Esegui i test — devono FALLIRE**

```bash
pytest tests/test_llm_utils.py -v -k "stream"
```
Expected: `ImportError` o `AttributeError` (llm_stream non esiste)

- [ ] **Step 5.3: Aggiungi `llm_stream` a `backend/llm_utils.py`**

Aggiungi in fondo al file (dopo `llm_call`):

```python
from typing import Generator


def llm_stream(agent: str, **kwargs) -> Generator[str, None, None]:
    """Streaming variant of llm_call. Yields text chunks as they arrive."""
    kwargs = {**kwargs, "stream": True}
    kwargs = _normalize_completion_kwargs(kwargs)
    messages = kwargs.get("messages", [])
    for msg in messages:
        role = msg.get("role", "?")
        content = msg.get("content", "")
        logger.info(f"[{agent}] → [{role}] {content[:200]}")

    for chunk in litellm.completion(**kwargs):
        content = chunk.choices[0].delta.content
        if content:
            logger.debug(f"[{agent}] chunk: {content!r}")
            yield content
```

- [ ] **Step 5.4: Esegui i test — devono PASSARE**

```bash
pytest tests/test_llm_utils.py -v
```
Expected: tutti i test passano.

- [ ] **Step 5.5: Modifica `response_agent.py` per supportare streaming**

Sostituisci la funzione `response_agent` intera:

```python
# backend/agents/response_agent.py
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
```

- [ ] **Step 5.6: Modifica `backend/main.py` — drain dello stream_queue**

Aggiorna la sezione del WebSocket handler dove avviene `GRAPH.invoke`. Sostituisci il blocco `try: ... result = GRAPH.invoke(state)` con:

```python
import asyncio
import queue as stdlib_queue

# (all'inizio del file, dopo gli altri import)
```

Poi dentro `websocket_endpoint`, sostituisci il blocco `try:` che chiama `GRAPH.invoke`:

```python
            try:
                logger.info("[ws] invocazione grafo LangGraph...")

                stream_q: stdlib_queue.Queue = stdlib_queue.Queue()
                loop = asyncio.get_event_loop()

                async def _drain_stream() -> None:
                    while True:
                        try:
                            chunk = stream_q.get_nowait()
                            await websocket.send_json({"type": "stream_chunk", "text": chunk})
                        except stdlib_queue.Empty:
                            await asyncio.sleep(0.02)

                graph_config = {"configurable": {"stream_queue": stream_q}}

                drain_task = asyncio.create_task(_drain_stream())
                result = await loop.run_in_executor(
                    None,
                    lambda: GRAPH.invoke(state, config=graph_config),
                )
                drain_task.cancel()

                # Flush any remaining chunks
                while not stream_q.empty():
                    chunk = stream_q.get_nowait()
                    await websocket.send_json({"type": "stream_chunk", "text": chunk})

                _sessions[session_id] = result
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
                    "code_error": "",
                })
```

- [ ] **Step 5.7: Esegui i test backend**

```bash
pytest tests/ -v --ignore=tests/__pycache__
```
Expected: tutti i test passano. Se `test_response_agent.py` fallisce per il nuovo parametro `config`, apri il file e aggiungi `config=None` alla chiamata mock.

- [ ] **Step 5.8: Commit**

```bash
git add backend/llm_utils.py backend/agents/response_agent.py backend/main.py tests/test_llm_utils.py
git commit -m "feat: add llm_stream, wire streaming response_agent with async drain in main.py"
```

---

## Task 6: Frontend — types + useWebSocket streaming

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 6.1: Scrivi il test**

Crea `frontend/src/hooks/useWebSocket.streaming.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor() { MockWebSocket.instances.push(this); }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("useWebSocket streaming", () => {
  it("accumulates stream_chunk into streamingText", () => {
    const { result } = renderHook(() => useWebSocket("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "Ciao " }) }); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "mondo" }) }); });

    expect(result.current.streamingText).toBe("Ciao mondo");
  });

  it("resets streamingText when update arrives", () => {
    const { result } = renderHook(() => useWebSocket("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(); });
    act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "stream_chunk", text: "partial" }) }); });
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: "update", code: "", knobs: [], message: "Done", creative_mode: false,
        }),
      });
    });

    expect(result.current.streamingText).toBe("");
    expect(result.current.lastUpdate?.message).toBe("Done");
  });
});
```

- [ ] **Step 6.2: Esegui il test — deve FALLIRE**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose useWebSocket.streaming
```
Expected: `Property 'streamingText' does not exist`

- [ ] **Step 6.3: Aggiorna `frontend/src/types.ts`**

Aggiungi il nuovo tipo e aggiorna `WsInMessage`:

```typescript
// Aggiungere dopo UpdateMessage:
export interface StreamChunkMessage {
  type: "stream_chunk";
  text: string;
}

// Aggiungere tipo unione (se non esiste già WsInMessage, aggiungerla):
export type WsInMessage = UpdateMessage | StreamChunkMessage;
```

- [ ] **Step 6.4: Aggiorna `frontend/src/hooks/useWebSocket.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateMessage, WsOutMessage } from "../types";

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<UpdateMessage | null>(null);
  const [streamingText, setStreamingText] = useState("");

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type === "stream_chunk") {
          setStreamingText((prev) => prev + (msg.text ?? ""));
        } else if (msg?.type === "update") {
          setStreamingText("");
          setLastUpdate(msg as UpdateMessage);
        }
      } catch { /* ignore malformed messages */ }
    };
    return () => ws.close();
  }, [url]);

  const sendMessage = useCallback((msg: WsOutMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, lastUpdate, sendMessage, streamingText };
}
```

- [ ] **Step 6.5: Esegui i test — devono PASSARE**

```bash
npm test -- --reporter=verbose useWebSocket
```
Expected: tutti i test passano.

- [ ] **Step 6.6: Commit**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/types.ts frontend/src/hooks/useWebSocket.ts frontend/src/hooks/useWebSocket.streaming.test.ts
git commit -m "feat: add streamingText to useWebSocket — accumulates stream_chunk frames"
```

---

## Task 7: Chat — rendering streaming in-progress

**Files:**
- Modify: `frontend/src/components/Chat.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 7.1: Scrivi il test**

Apri `frontend/src/App.test.tsx` e aggiungi:

```typescript
it("passes streamingText to Chat as isWaiting=true while streaming", () => {
  // This is an integration smoke test — verify streamingText prop flows to Chat
  // The actual streaming rendering is in Chat's internal animatedContents logic
  render(<App />);
  // App renders Chat — if streamingText is non-empty, isWaiting should be true
  // We can't mock WS easily here, so just verify Chat mounts without error
  expect(screen.getByPlaceholderText(/messaggio/i)).toBeInTheDocument();
});
```

- [ ] **Step 7.2: Aggiorna `Chat.tsx` per accettare e mostrare `streamingText`**

Aggiungi la prop `streamingText` all'interfaccia `Props`:

```typescript
interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isConnected: boolean;
  isWaiting: boolean;
  streamingText?: string;   // ← aggiunta
}
```

Nel corpo del componente, sostituisci il `TypingIndicator` con la logica streaming:

```typescript
export function Chat({ messages, onSend, isConnected, isWaiting, streamingText = "" }: Props) {
  // ... codice esistente ...

  // Nel render, sostituire il blocco {isWaiting && <TypingIndicator />} con:
  {isWaiting && !streamingText && <TypingIndicator />}
  {streamingText && (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
    }}>
      <div style={{ ...LABEL_STYLE_BASE, color: "#00d4aa66" }}>ASSISTENTE</div>
      <div style={{
        background: "#0a1f18",
        border: "1px solid #1a3a2a",
        borderRadius: "0 12px 12px 12px",
        padding: "10px 14px",
        color: "#c8e6d8",
        fontSize: "0.88rem",
        lineHeight: "1.55",
        maxWidth: "88%",
        whiteSpace: "pre-wrap",
      }}>
        {streamingText}
        <span style={{
          display: "inline-block",
          width: "2px", height: "1em",
          background: "#00d4aa",
          marginLeft: "2px",
          animation: "blink 1s step-end infinite",
          verticalAlign: "text-bottom",
        }} />
      </div>
    </div>
  )}
```

Aggiungi il keyframe `blink` a `frontend/src/index.css`:

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

- [ ] **Step 7.3: Aggiorna `App.tsx` — passa `streamingText` a Chat**

Trova `useWebSocket` in `App.tsx` e destruttura `streamingText`:

```typescript
const { isConnected, lastUpdate, sendMessage, streamingText } = useWebSocket(WS_URL);
```

Trova il render di `<Chat` e aggiungi la prop:

```tsx
<Chat
  messages={messages}
  onSend={handleSend}
  isConnected={isConnected}
  isWaiting={isWaiting}
  streamingText={streamingText}   // ← aggiunta
/>
```

- [ ] **Step 7.4: Esegui tutti i test frontend**

```bash
cd /Users/vitto/Desktop/music/frontend && npm test -- --reporter=verbose
```
Expected: tutti i test passano (61+ test).

- [ ] **Step 7.5: Esegui tutti i test backend**

```bash
cd /Users/vitto/Desktop/music && source backend/.venv/bin/activate && pytest tests/ -v
```
Expected: tutti i test passano.

- [ ] **Step 7.6: Commit finale Sprint 1**

```bash
cd /Users/vitto/Desktop/music
git add frontend/src/components/Chat.tsx frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: show streaming text in Chat with cursor blink while AI responds"
```

---

## Verifica end-to-end

Dopo aver completato tutti i task:

- [ ] Avvia backend: `cd backend && source .venv/bin/activate && uvicorn backend.main:app --reload`
- [ ] Avvia frontend: `cd frontend && npm run dev`
- [ ] Apri `http://localhost:5173`
- [ ] Invia un messaggio chat → verifica che il testo arrivi in streaming (caratteri progressivi con cursore)
- [ ] Forza un errore Strudel nel player (es. scrivi `nonexistentFn()` e premi play) → verifica che l'AI risponda con una patch automatica entro 5s
- [ ] Chiedi "fai un pattern con bass" → verifica che il codice generato usi sample validi (`bass`, `bd`, etc.) e non nomi inventati

---

## Note per gli sprint successivi

I piani per Sprint 2–5 sono separati e indipendenti:
- `2026-05-23-sprint2-preset-ui.md` (da scrivere)
- `2026-05-23-sprint3-code-editor.md` (da scrivere)
- `2026-05-23-sprint4-scene-system.md` (da scrivere)
- `2026-05-23-sprint5-live-kit.md` (da scrivere)
