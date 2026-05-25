# Music Multi-Agent System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent system (LangGraph + FastAPI + React) that lets non-musicians create and perform music live by describing what they want in plain language, with Strudel REPL generating the audio.

**Architecture:** Supervisor-pattern LangGraph graph with 6 agents (Supervisor, Music Expert, Creative, Strudel Coder, Knobs, Response). FastAPI WebSocket bridges the graph to a React frontend with embedded Strudel player, dynamic knobs, and a Web Audio API recorder.

**Tech Stack:** Python 3.11, LangGraph 0.2+, LiteLLM 1.40+, FastAPI, uvicorn, PyYAML — React 18, Vite, TypeScript, @strudel/web

---

## File Map

### Backend

| File | Responsibility |
|---|---|
| `backend/state.py` | MusicState TypedDict — shared LangGraph state |
| `backend/prompt_loader.py` | Load + interpolate YAML prompt files |
| `backend/config.yaml` | LiteLLM provider config |
| `backend/agents/supervisor.py` | Intent classification + routing |
| `backend/agents/music_expert.py` | Natural language → musical specs |
| `backend/agents/strudel_coder.py` | Musical specs → Strudel code |
| `backend/agents/knobs_agent.py` | Strudel code → dynamic knob list |
| `backend/agents/creative_agent.py` | Creative advice + autonomous composition |
| `backend/agents/response_agent.py` | Human-readable response generation |
| `backend/graph.py` | LangGraph graph wiring + conditional edges |
| `backend/main.py` | FastAPI app + WebSocket endpoint + file writer |
| `backend/prompts/*.yaml` | System + user prompts per agent |

### Tests

| File | What it tests |
|---|---|
| `tests/test_state.py` | State schema + initial state factory |
| `tests/test_prompt_loader.py` | YAML loading + interpolation |
| `tests/test_supervisor.py` | Intent classification and routing updates |
| `tests/test_music_expert.py` | Natural language → musical context merge |
| `tests/test_strudel_coder.py` | Specs → Strudel code generation |
| `tests/test_knobs_agent.py` | Knob extraction from code |
| `tests/test_creative_agent.py` | Advisor + autonomous creative modes |
| `tests/test_response_agent.py` | Response message generation |
| `tests/test_graph.py` | End-to-end graph routing |
| `tests/test_websocket.py` | WebSocket message protocol |

### Frontend

| File | Responsibility |
|---|---|
| `frontend/src/types.ts` | Shared TypeScript interfaces |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket connection + message handling |
| `frontend/src/components/StrudelPlayer.tsx` | Embedded Strudel player |
| `frontend/src/components/KnobPanel.tsx` | Dynamic knob controls |
| `frontend/src/components/Chat.tsx` | Conversational interface |
| `frontend/src/components/Recorder.tsx` | Web Audio API performance recording |
| `frontend/src/App.tsx` | Layout + state coordination |

---

## Phase 1: Backend Foundation

### Task 1: Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/config.yaml`
- Create: `backend/__init__.py`
- Create: `backend/agents/__init__.py`
- Create: `backend/prompts/` (directory)
- Create: `tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/vitto/Desktop/music
mkdir -p backend/agents backend/prompts tests
touch backend/__init__.py backend/agents/__init__.py tests/__init__.py
```

- [ ] **Step 2: Create requirements.txt**

```
# backend/requirements.txt
langgraph>=0.2.0
langchain>=0.3.0
langchain-core>=0.3.0
litellm>=1.40.0
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pyyaml>=6.0
websockets>=12.0
pytest>=8.0
pytest-asyncio>=0.23
httpx>=0.27
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/vitto/Desktop/music/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 4: Create config.yaml**

```yaml
# backend/config.yaml
llm:
  model: "anthropic/claude-haiku-4-5-20251001"
  temperature: 0.7
  max_tokens: 2048
```

- [ ] **Step 5: Init git and commit**

```bash
cd /Users/vitto/Desktop/music
git init
git add backend/ tests/
git commit -m "chore: backend project setup"
```

---

### Task 2: Shared State

**Files:**
- Create: `backend/state.py`
- Create: `tests/test_state.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_state.py
from backend.state import MusicState, KnobConfig, create_initial_state

def test_initial_state_has_empty_code():
    state = create_initial_state()
    assert state["strudel_code"] == ""

def test_initial_state_creative_mode_off():
    state = create_initial_state()
    assert state["creative_mode"] is False

def test_initial_state_has_empty_knobs():
    state = create_initial_state()
    assert state["active_knobs"] == []

def test_knob_config_fields():
    knob = KnobConfig(
        name="BPM", strudel_param="setcps",
        min=0.5, max=3.0, value=1.4, color="#fc9"
    )
    assert knob.name == "BPM"
    assert knob.min == 0.5
    assert knob.color == "#fc9"
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd /Users/vitto/Desktop/music/backend
source .venv/bin/activate
python -m pytest ../tests/test_state.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.state'`

- [ ] **Step 3: Implement state.py**

```python
# backend/state.py
import operator
from dataclasses import dataclass
from typing import Annotated, TypedDict


@dataclass
class KnobConfig:
    name: str
    strudel_param: str
    min: float
    max: float
    value: float
    color: str = "#9cf"


class MusicState(TypedDict):
    strudel_code: str
    musical_context: dict
    conversation_history: Annotated[list, operator.add]
    active_knobs: list
    user_intent: str
    creative_mode: bool
    creative_suggestions: list
    agent_message: str
    next_agents: list


def create_initial_state() -> MusicState:
    return MusicState(
        strudel_code="",
        musical_context={},
        conversation_history=[],
        active_knobs=[],
        user_intent="",
        creative_mode=False,
        creative_suggestions=[],
        agent_message="",
        next_agents=[],
    )
```

- [ ] **Step 4: Run — verify PASS**

```bash
python -m pytest ../tests/test_state.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/state.py tests/test_state.py
git commit -m "feat: add shared LangGraph state"
```

---

### Task 3: Prompt Loader

**Files:**
- Create: `backend/prompt_loader.py`
- Create: `tests/test_prompt_loader.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_prompt_loader.py
import os, tempfile, pytest, yaml
from backend.prompt_loader import load_prompt, interpolate_prompt

def test_load_prompt_returns_system_and_user():
    with tempfile.NamedTemporaryFile(suffix=".yaml", mode="w", delete=False) as f:
        yaml.dump({"system": "You are a musician.", "user": "User said: {message}"}, f)
        path = f.name
    try:
        prompt = load_prompt(path)
        assert "system" in prompt
        assert "user" in prompt
    finally:
        os.unlink(path)

def test_interpolate_fills_placeholders():
    result = interpolate_prompt("Genre: {genre}, BPM: {bpm}", {"genre": "jazz", "bpm": "120"})
    assert result == "Genre: jazz, BPM: 120"

def test_interpolate_missing_key_raises():
    with pytest.raises(KeyError):
        interpolate_prompt("Hello {name}", {})

def test_load_prompt_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_prompt("/nonexistent/prompt.yaml")
```

- [ ] **Step 2: Run — verify FAIL**

```bash
python -m pytest ../tests/test_prompt_loader.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.prompt_loader'`

- [ ] **Step 3: Implement prompt_loader.py**

```python
# backend/prompt_loader.py
from pathlib import Path
import yaml


def load_prompt(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    with open(p) as f:
        data = yaml.safe_load(f)
    assert "system" in data and "user" in data, \
        f"{path} must have 'system' and 'user' keys"
    return data


def interpolate_prompt(template: str, variables: dict) -> str:
    return template.format(**variables)
```

- [ ] **Step 4: Run — verify PASS**

```bash
python -m pytest ../tests/test_prompt_loader.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prompt_loader.py tests/test_prompt_loader.py
git commit -m "feat: add YAML prompt loader"
```

---

## Phase 2: Agents

### Task 4: Supervisor Agent

**Files:**
- Create: `backend/prompts/supervisor.yaml`
- Create: `backend/agents/supervisor.py`
- Create: `tests/test_supervisor.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/supervisor.yaml
system: |
  You are the supervisor of a music multi-agent system. Classify the user's intent and decide which agents to activate.

  Current musical context: {musical_context}
  Creative mode active: {creative_mode}

  Respond ONLY with valid JSON:
  {{"intent": "<intent>", "next_agents": ["<agent1>", ...]}}

  Intent → agent sequences:
  - "modify_track": ["music_expert", "strudel_coder", "knobs_agent", "response_agent"]
  - "move_knob": ["strudel_coder"]
  - "chat": ["response_agent"]
  - "creative_autonomous": ["creative_agent", "strudel_coder", "knobs_agent", "response_agent"]
  - "creative_advice": ["creative_agent", "response_agent"]
  - "start_from_scratch": ["music_expert", "strudel_coder", "knobs_agent", "response_agent"]

user: |
  User message: "{user_message}"
  Classify the intent and return JSON.
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_supervisor.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.supervisor import supervisor_agent

def _mock_llm(json_str: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = json_str
    return mock

def test_supervisor_routes_modify_track():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "aggiungi un basso"}]
    with patch("backend.agents.supervisor.litellm.completion") as m:
        m.return_value = _mock_llm(
            '{"intent":"modify_track","next_agents":["music_expert","strudel_coder","knobs_agent","response_agent"]}'
        )
        result = supervisor_agent(state)
    assert result["user_intent"] == "modify_track"
    assert "music_expert" in result["next_agents"]

def test_supervisor_routes_knob_change():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "[KNOB] lpf=800"}]
    with patch("backend.agents.supervisor.litellm.completion") as m:
        m.return_value = _mock_llm('{"intent":"move_knob","next_agents":["strudel_coder"]}')
        result = supervisor_agent(state)
    assert result["user_intent"] == "move_knob"
    assert result["next_agents"] == ["strudel_coder"]

def test_supervisor_sets_creative_mode_on_autonomous():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "fai tu, sorprendimi"}]
    with patch("backend.agents.supervisor.litellm.completion") as m:
        m.return_value = _mock_llm(
            '{"intent":"creative_autonomous","next_agents":["creative_agent","strudel_coder","knobs_agent","response_agent"]}'
        )
        result = supervisor_agent(state)
    assert result["user_intent"] == "creative_autonomous"
    assert result["creative_mode"] is True
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_supervisor.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement supervisor.py**

```python
# backend/agents/supervisor.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "supervisor.yaml"


def _get_model() -> str:
    return os.environ.get("LLM_MODEL", "anthropic/claude-haiku-4-5-20251001")


def supervisor_agent(state: MusicState) -> dict:
    prompt = load_prompt(str(PROMPT_PATH))
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    system = interpolate_prompt(prompt["system"], {
        "musical_context": json.dumps(state["musical_context"]),
        "creative_mode": str(state["creative_mode"]),
    })
    user = interpolate_prompt(prompt["user"], {"user_message": last_message})

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )
    result = json.loads(response.choices[0].message.content)

    updates = {
        "user_intent": result["intent"],
        "next_agents": result["next_agents"],
    }
    if result["intent"] == "creative_autonomous":
        updates["creative_mode"] = True
    return updates
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_supervisor.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/supervisor.py backend/prompts/supervisor.yaml tests/test_supervisor.py
git commit -m "feat: add supervisor agent"
```

---

### Task 5: Music Expert Agent

**Files:**
- Create: `backend/prompts/music_expert.yaml`
- Create: `backend/agents/music_expert.py`
- Create: `tests/test_music_expert.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/music_expert.yaml
system: |
  You are an expert musician and music theorist. Translate non-technical descriptions into precise musical specifications.

  Current musical context: {musical_context}

  Respond ONLY with valid JSON containing fields to update. Example:
  {{"bpm": 85, "mood": "melancholic", "key": "c_minor", "instruments": ["piano", "bass"], "effects": ["reverb"], "intensity": "low"}}

user: |
  The user said: "{user_message}"
  Current context: {musical_context}
  Return updated musical specifications as JSON.
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_music_expert.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.music_expert import music_expert_agent

def _mock_llm(json_str: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = json_str
    return mock

def test_music_expert_updates_context():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "qualcosa di rilassante tipo lofi"}]
    with patch("backend.agents.music_expert.litellm.completion") as m:
        m.return_value = _mock_llm(
            '{"bpm":75,"mood":"relaxed","key":"f_major","instruments":["piano","vinyl_crackle"],"effects":["reverb","lpf"],"intensity":"low"}'
        )
        result = music_expert_agent(state)
    assert result["musical_context"]["bpm"] == 75
    assert result["musical_context"]["mood"] == "relaxed"
    assert "piano" in result["musical_context"]["instruments"]

def test_music_expert_merges_with_existing_context():
    state = create_initial_state()
    state["musical_context"] = {"bpm": 120, "mood": "energetic"}
    state["conversation_history"] = [{"role": "user", "content": "più malinconico"}]
    with patch("backend.agents.music_expert.litellm.completion") as m:
        m.return_value = _mock_llm('{"mood":"melancholic","key":"a_minor"}')
        result = music_expert_agent(state)
    assert result["musical_context"]["bpm"] == 120       # preserved
    assert result["musical_context"]["mood"] == "melancholic"  # updated
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_music_expert.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement music_expert.py**

```python
# backend/agents/music_expert.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "music_expert.yaml"


def _get_model() -> str:
    return os.environ.get("LLM_MODEL", "anthropic/claude-haiku-4-5-20251001")


def music_expert_agent(state: MusicState) -> dict:
    prompt = load_prompt(str(PROMPT_PATH))
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    system = interpolate_prompt(prompt["system"], {
        "musical_context": json.dumps(state["musical_context"]),
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_message,
        "musical_context": json.dumps(state["musical_context"]),
    })

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
    )
    updates = json.loads(response.choices[0].message.content)
    return {"musical_context": {**state["musical_context"], **updates}}
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_music_expert.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/music_expert.py backend/prompts/music_expert.yaml tests/test_music_expert.py
git commit -m "feat: add music expert agent"
```

---

### Task 6: Strudel Coder Agent

**Files:**
- Create: `backend/prompts/strudel_coder.yaml`
- Create: `backend/agents/strudel_coder.py`
- Create: `tests/test_strudel_coder.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/strudel_coder.yaml
system: |
  You are an expert in the Strudel REPL live coding language for music. Write and modify Strudel code based on musical specifications.

  Rules:
  - Return ONLY valid Strudel code, no explanations
  - Modify existing code incrementally — never rewrite from scratch unless told to start fresh
  - Use $: prefix for named patterns (e.g. $: note("c3 e3").slow(2))
  - Keep structure with sections: // MUSIC, // S1, // S2, // DRUMS
  - Current code: {strudel_code}
  - Musical context: {musical_context}
  - Knob change: {knob_change}

user: |
  Musical specifications: {musical_specs}
  Current Strudel code:
  {strudel_code}

  Return the updated Strudel code only.
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_strudel_coder.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.strudel_coder import strudel_coder_agent

def _mock_llm(code: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = code
    return mock

NEW_CODE = '$: note("c3 e3 g3").slow(2).lpf(800).room(0.4)'

def test_strudel_coder_returns_updated_code():
    state = create_initial_state()
    state["musical_context"] = {"bpm": 75, "mood": "relaxed"}
    with patch("backend.agents.strudel_coder.litellm.completion") as m:
        m.return_value = _mock_llm(NEW_CODE)
        result = strudel_coder_agent(state)
    assert result["strudel_code"] == NEW_CODE

def test_strudel_coder_handles_knob_change():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(400)'
    state["conversation_history"] = [{"role": "user", "content": "[KNOB] lpf=800"}]
    updated = '$: note("c3").lpf(800)'
    with patch("backend.agents.strudel_coder.litellm.completion") as m:
        m.return_value = _mock_llm(updated)
        result = strudel_coder_agent(state)
    assert result["strudel_code"] == updated
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_strudel_coder.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement strudel_coder.py**

```python
# backend/agents/strudel_coder.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "strudel_coder.yaml"


def _get_model() -> str:
    return os.environ.get("LLM_MODEL", "anthropic/claude-haiku-4-5-20251001")


def _extract_knob_change(state: MusicState) -> str:
    if not state["conversation_history"]:
        return "none"
    last = state["conversation_history"][-1]["content"]
    return last if last.startswith("[KNOB]") else "none"


def strudel_coder_agent(state: MusicState) -> dict:
    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
        "knob_change": _extract_knob_change(state),
    })
    user = interpolate_prompt(prompt["user"], {
        "musical_specs": json.dumps(state["musical_context"]),
        "strudel_code": state["strudel_code"] or "// empty",
    })

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    return {"strudel_code": response.choices[0].message.content.strip()}
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_strudel_coder.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/strudel_coder.py backend/prompts/strudel_coder.yaml tests/test_strudel_coder.py
git commit -m "feat: add strudel coder agent"
```

---

### Task 7: Knobs Agent

**Files:**
- Create: `backend/prompts/knobs_agent.yaml`
- Create: `backend/agents/knobs_agent.py`
- Create: `tests/test_knobs_agent.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/knobs_agent.yaml
system: |
  You are an expert in the Strudel REPL language. Analyze Strudel code and identify the most musically meaningful parameters to expose as interactive knobs.

  For each knob provide:
  - name: human-readable label (e.g. "BPM", "Low-Pass Filter", "Reverb")
  - strudel_param: exact Strudel function name
  - min: minimum sensible value
  - max: maximum sensible value
  - value: current value extracted from code
  - color: hex color (#fc9 tempo, #9cf filter, #7c9 effects, #f9c volume, #c9f pitch)

  Respond ONLY with a JSON array. Maximum 6 knobs.

user: |
  Current Strudel code:
  {strudel_code}

  Return the knob list as a JSON array.
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_knobs_agent.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.knobs_agent import knobs_agent

def _mock_llm(json_str: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = json_str
    return mock

KNOBS_JSON = '[{"name":"BPM","strudel_param":"setcps","min":0.5,"max":3.0,"value":1.4,"color":"#fc9"},{"name":"Filtro","strudel_param":"lpf","min":200,"max":8000,"value":800,"color":"#9cf"}]'

def test_knobs_agent_returns_list():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3 e3").setcps(1.4).lpf(800)'
    with patch("backend.agents.knobs_agent.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    assert isinstance(result["active_knobs"], list)
    assert len(result["active_knobs"]) == 2

def test_knobs_agent_knob_has_required_fields():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(800)'
    with patch("backend.agents.knobs_agent.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    for field in ["name", "strudel_param", "min", "max", "value", "color"]:
        assert field in result["active_knobs"][0], f"Missing: {field}"

def test_knobs_agent_returns_empty_for_no_code():
    state = create_initial_state()
    result = knobs_agent(state)
    assert result["active_knobs"] == []
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_knobs_agent.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement knobs_agent.py**

```python
# backend/agents/knobs_agent.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "knobs_agent.yaml"


def _get_model() -> str:
    return os.environ.get("LLM_MODEL", "anthropic/claude-haiku-4-5-20251001")


def knobs_agent(state: MusicState) -> dict:
    if not state["strudel_code"]:
        return {"active_knobs": []}

    prompt = load_prompt(str(PROMPT_PATH))
    system = interpolate_prompt(prompt["system"], {})
    user = interpolate_prompt(prompt["user"], {"strudel_code": state["strudel_code"]})

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )
    knobs = json.loads(response.choices[0].message.content)
    return {"active_knobs": knobs[:6]}
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_knobs_agent.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/knobs_agent.py backend/prompts/knobs_agent.yaml tests/test_knobs_agent.py
git commit -m "feat: add knobs agent"
```

---

### Task 8: Creative Agent

**Files:**
- Create: `backend/prompts/creative_agent.yaml`
- Create: `backend/agents/creative_agent.py`
- Create: `tests/test_creative_agent.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/creative_agent.yaml
system: |
  You are a creative music director and composer with deep knowledge of music theory, arrangement, and production.

  Current track: {strudel_code}
  Musical context: {musical_context}
  Mode: {mode}

  ADVISOR mode: analyze the track and suggest 2-3 specific creative directions. Be concrete and inspiring.
  AUTONOMOUS mode: compose a complete creative variation. Think like a producer — add tension, movement, surprise.

  Respond ONLY with JSON:
  {{"mode":"advisor|autonomous","suggestions":[...],"musical_specs":{{...}},"reasoning":"..."}}

user: |
  {user_message}
  Current Strudel code: {strudel_code}
  Musical context: {musical_context}
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_creative_agent.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.creative_agent import creative_agent

def _mock_llm(json_str: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = json_str
    return mock

ADVISOR_RESP = '{"mode":"advisor","suggestions":["Add an arpeggio","Try a syncopated bass"],"musical_specs":{},"reasoning":"Track needs movement"}'
AUTONOMOUS_RESP = '{"mode":"autonomous","suggestions":[],"musical_specs":{"bpm":95,"mood":"melancholic","add":["arpeggio","pad"]},"reasoning":"Added harmonic tension"}'

def test_creative_agent_advisor_returns_suggestions():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "hai consigli?"}]
    state["strudel_code"] = '$: note("c3 e3 g3").slow(2)'
    with patch("backend.agents.creative_agent.litellm.completion") as m:
        m.return_value = _mock_llm(ADVISOR_RESP)
        result = creative_agent(state)
    assert "creative_suggestions" in result
    assert len(result["creative_suggestions"]) == 2

def test_creative_agent_autonomous_updates_musical_context():
    state = create_initial_state()
    state["creative_mode"] = True
    state["conversation_history"] = [{"role": "user", "content": "fai tu"}]
    state["strudel_code"] = '$: note("c3 e3 g3").slow(2)'
    with patch("backend.agents.creative_agent.litellm.completion") as m:
        m.return_value = _mock_llm(AUTONOMOUS_RESP)
        result = creative_agent(state)
    assert result["musical_context"]["bpm"] == 95
    assert result["musical_context"]["mood"] == "melancholic"
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_creative_agent.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement creative_agent.py**

```python
# backend/agents/creative_agent.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "creative_agent.yaml"


def _get_model() -> str:
    # Creative agent gets a stronger model by default
    return os.environ.get("LLM_MODEL_CREATIVE", os.environ.get("LLM_MODEL", "anthropic/claude-sonnet-4-6"))


def creative_agent(state: MusicState) -> dict:
    prompt = load_prompt(str(PROMPT_PATH))
    mode = "autonomous" if state["creative_mode"] else "advisor"
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    system = interpolate_prompt(prompt["system"], {
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
        "mode": mode,
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_message,
        "strudel_code": state["strudel_code"] or "// empty",
        "musical_context": json.dumps(state["musical_context"]),
    })

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.8,
    )
    result = json.loads(response.choices[0].message.content)

    updates: dict = {"creative_suggestions": result.get("suggestions", [])}
    if mode == "autonomous" and result.get("musical_specs"):
        updates["musical_context"] = {**state["musical_context"], **result["musical_specs"]}
    return updates
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_creative_agent.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/creative_agent.py backend/prompts/creative_agent.yaml tests/test_creative_agent.py
git commit -m "feat: add creative agent (advisor + autonomous)"
```

---

### Task 9: Response Agent

**Files:**
- Create: `backend/prompts/response_agent.yaml`
- Create: `backend/agents/response_agent.py`
- Create: `tests/test_response_agent.py`

- [ ] **Step 1: Create prompt file**

```yaml
# backend/prompts/response_agent.yaml
system: |
  You are a friendly music collaborator helping a non-musician create music. Speak simply and encouragingly — no jargon.

  Your response must:
  - Describe what changed in the music (1-2 sentences max)
  - Suggest one concrete next step OR ask one guiding question
  - If creative suggestions are available, mention one of them

  Language: {language}
  Creative mode: {creative_mode}
  Creative suggestions: {creative_suggestions}

user: |
  User said: "{user_message}"
  Musical context now: {musical_context}
  New code generated: {has_new_code}

  Write a short, friendly response.
```

- [ ] **Step 2: Write failing test**

```python
# tests/test_response_agent.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.response_agent import response_agent

def _mock_llm(text: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = text
    return mock

def test_response_agent_returns_message():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "aggiungi un basso"}]
    state["musical_context"] = {"bpm": 75, "mood": "relaxed"}
    state["strudel_code"] = '$: note("c3").slow(2)'
    with patch("backend.agents.response_agent.litellm.completion") as m:
        m.return_value = _mock_llm("Ho aggiunto un basso morbido! Vuoi rallentare ancora?")
        result = response_agent(state)
    assert result["agent_message"] == "Ho aggiunto un basso morbido! Vuoi rallentare ancora?"

def test_response_agent_returns_non_empty_string():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "ciao"}]
    with patch("backend.agents.response_agent.litellm.completion") as m:
        m.return_value = _mock_llm("Ciao! Cosa vuoi creare oggi?")
        result = response_agent(state)
    assert isinstance(result["agent_message"], str)
    assert len(result["agent_message"]) > 0
```

- [ ] **Step 3: Run — verify FAIL**

```bash
python -m pytest ../tests/test_response_agent.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 4: Implement response_agent.py**

```python
# backend/agents/response_agent.py
import json
import os
from pathlib import Path

import litellm

from backend.prompt_loader import interpolate_prompt, load_prompt
from backend.state import MusicState

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "response_agent.yaml"


def _get_model() -> str:
    return os.environ.get("LLM_MODEL", "anthropic/claude-haiku-4-5-20251001")


def response_agent(state: MusicState) -> dict:
    prompt = load_prompt(str(PROMPT_PATH))
    last_message = (
        state["conversation_history"][-1]["content"]
        if state["conversation_history"] else ""
    )
    system = interpolate_prompt(prompt["system"], {
        "language": os.environ.get("RESPONSE_LANGUAGE", "Italian"),
        "creative_mode": str(state["creative_mode"]),
        "creative_suggestions": json.dumps(state.get("creative_suggestions", [])),
    })
    user = interpolate_prompt(prompt["user"], {
        "user_message": last_message,
        "musical_context": json.dumps(state["musical_context"]),
        "has_new_code": "yes" if state["strudel_code"] else "no",
    })

    response = litellm.completion(
        model=_get_model(),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
    )
    return {"agent_message": response.choices[0].message.content.strip()}
```

- [ ] **Step 5: Run — verify PASS**

```bash
python -m pytest ../tests/test_response_agent.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/agents/response_agent.py backend/prompts/response_agent.yaml tests/test_response_agent.py
git commit -m "feat: add response agent"
```

---

## Phase 3: Graph + API

### Task 10: LangGraph Graph Wiring

**Files:**
- Create: `backend/graph.py`
- Create: `tests/test_graph.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_graph.py
from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.graph import build_graph

def _mk(content: str) -> MagicMock:
    m = MagicMock()
    m.choices[0].message.content = content
    return m

def test_graph_builds():
    graph = build_graph()
    assert graph is not None

def test_graph_modify_track_flow():
    graph = build_graph()
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "aggiungi percussioni"}]

    with patch("backend.agents.supervisor.litellm.completion") as sup, \
         patch("backend.agents.music_expert.litellm.completion") as me, \
         patch("backend.agents.strudel_coder.litellm.completion") as sc, \
         patch("backend.agents.knobs_agent.litellm.completion") as ka, \
         patch("backend.agents.response_agent.litellm.completion") as ra:

        sup.return_value = _mk('{"intent":"modify_track","next_agents":["music_expert","strudel_coder","knobs_agent","response_agent"]}')
        me.return_value = _mk('{"bpm":120,"mood":"energetic"}')
        sc.return_value = _mk('$: sound("bd").fast(2)')
        ka.return_value = _mk('[{"name":"BPM","strudel_param":"setcps","min":0.5,"max":3.0,"value":2.0,"color":"#fc9"}]')
        ra.return_value = _mk("Ho aggiunto le percussioni!")

        result = graph.invoke(state)

    assert result["strudel_code"] == '$: sound("bd").fast(2)'
    assert result["agent_message"] == "Ho aggiunto le percussioni!"
    assert len(result["active_knobs"]) == 1
```

- [ ] **Step 2: Run — verify FAIL**

```bash
python -m pytest ../tests/test_graph.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.graph'`

- [ ] **Step 3: Implement graph.py**

```python
# backend/graph.py
from langgraph.graph import END, StateGraph

from backend.agents.creative_agent import creative_agent
from backend.agents.knobs_agent import knobs_agent
from backend.agents.music_expert import music_expert_agent
from backend.agents.response_agent import response_agent
from backend.agents.strudel_coder import strudel_coder_agent
from backend.agents.supervisor import supervisor_agent
from backend.state import MusicState


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


def _route_from_strudel_coder(state: MusicState) -> str:
    agents = state.get("next_agents", [])
    return "knobs_agent" if "knobs_agent" in agents else "response_agent"


def build_graph() -> StateGraph:
    g = StateGraph(MusicState)

    g.add_node("supervisor", supervisor_agent)
    g.add_node("music_expert", music_expert_agent)
    g.add_node("creative_agent", creative_agent)
    g.add_node("strudel_coder", strudel_coder_agent)
    g.add_node("knobs_agent", knobs_agent)
    g.add_node("response_agent", response_agent)

    g.set_entry_point("supervisor")

    g.add_conditional_edges("supervisor", _route_from_supervisor, {
        "music_expert": "music_expert",
        "creative_agent": "creative_agent",
        "strudel_coder": "strudel_coder",
        "response_agent": "response_agent",
    })
    g.add_conditional_edges("music_expert", _route_from_music_expert, {
        "strudel_coder": "strudel_coder",
        "response_agent": "response_agent",
    })
    g.add_conditional_edges("creative_agent", _route_from_creative, {
        "strudel_coder": "strudel_coder",
        "response_agent": "response_agent",
    })
    g.add_conditional_edges("strudel_coder", _route_from_strudel_coder, {
        "knobs_agent": "knobs_agent",
        "response_agent": "response_agent",
    })
    g.add_edge("knobs_agent", "response_agent")
    g.add_edge("response_agent", END)

    return g.compile()
```

- [ ] **Step 4: Run — verify PASS**

```bash
python -m pytest ../tests/test_graph.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/graph.py tests/test_graph.py
git commit -m "feat: wire LangGraph supervisor graph"
```

---

### Task 11: FastAPI WebSocket Server

**Files:**
- Create: `backend/main.py`
- Create: `tests/test_websocket.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_websocket.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app

def test_health_endpoint():
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}

def test_websocket_sends_connected_on_open():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connected"

def test_websocket_handles_user_message():
    mock_result = {
        "strudel_code": '$: note("c3")',
        "active_knobs": [],
        "agent_message": "Ciao!",
        "creative_mode": False,
        "musical_context": {},
        "conversation_history": [],
        "user_intent": "chat",
        "next_agents": [],
        "creative_suggestions": [],
    }
    with patch("backend.main.GRAPH") as mock_graph:
        mock_graph.invoke.return_value = mock_result
        client = TestClient(app)
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # consume "connected"
            ws.send_json({"type": "user_message", "message": "ciao"})
            response = ws.receive_json()
    assert response["type"] == "update"
    assert response["code"] == '$: note("c3")'
    assert response["message"] == "Ciao!"
```

- [ ] **Step 2: Run — verify FAIL**

```bash
python -m pytest ../tests/test_websocket.py -v
```

Expected: `ModuleNotFoundError: No module named 'backend.main'`

- [ ] **Step 3: Implement main.py**

```python
# backend/main.py
import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.graph import build_graph
from backend.state import MusicState, create_initial_state

app = FastAPI(title="Music Multi-Agent System")
GRAPH = build_graph()
STRUDEL_FILE = Path(__file__).parent.parent / ".strudel"

_sessions: dict[str, MusicState] = {}


def _write_strudel_file(code: str) -> None:
    STRUDEL_FILE.write_text(code, encoding="utf-8")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    _sessions[session_id] = create_initial_state()
    await websocket.send_json({"type": "connected"})

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            state = _sessions[session_id]

            if msg["type"] == "user_message":
                state["conversation_history"].append(
                    {"role": "user", "content": msg["message"]}
                )
            elif msg["type"] == "knob_change":
                state["conversation_history"].append(
                    {"role": "user", "content": f"[KNOB] {msg['knob_name']}={msg['value']}"}
                )

            result = GRAPH.invoke(state)
            _sessions[session_id] = result

            if result.get("strudel_code"):
                _write_strudel_file(result["strudel_code"])

            await websocket.send_json({
                "type": "update",
                "code": result.get("strudel_code", ""),
                "knobs": result.get("active_knobs", []),
                "message": result.get("agent_message", ""),
                "creative_mode": result.get("creative_mode", False),
            })

    except WebSocketDisconnect:
        _sessions.pop(session_id, None)
```

- [ ] **Step 4: Run — verify PASS**

```bash
python -m pytest ../tests/test_websocket.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full backend suite**

```bash
python -m pytest ../tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py tests/test_websocket.py
git commit -m "feat: add FastAPI WebSocket server + .strudel file sync"
```

---

## Phase 4: Frontend

### Task 12: Frontend Setup

**Files:**
- Create: `frontend/` (Vite + React + TS)
- Create: `frontend/src/types.ts`
- Create: `frontend/src/test-setup.ts`

- [ ] **Step 1: Scaffold frontend**

```bash
cd /Users/vitto/Desktop/music
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install @strudel/web
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Create shared types**

```typescript
// frontend/src/types.ts
export interface Knob {
  name: string;
  strudel_param: string;
  min: number;
  max: number;
  value: number;
  color: string;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

export interface UpdateMessage {
  type: "update";
  code: string;
  knobs: Knob[];
  message: string;
  creative_mode: boolean;
}

export type WsOutMessage =
  | { type: "user_message"; message: string }
  | { type: "knob_change"; knob_name: string; value: number };
```

- [ ] **Step 4: Configure vitest**

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: Create test setup file**

```typescript
// frontend/src/test-setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold React frontend with Vite + TypeScript"
```

---

### Task 13: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useWebSocket.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/hooks/useWebSocket.test.ts
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal("WebSocket", MockWebSocket);

test("exposes sendMessage, lastUpdate, isConnected", () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  expect(result.current.sendMessage).toBeDefined();
  expect(result.current.lastUpdate).toBeNull();
  expect(result.current.isConnected).toBe(false);
});

test("isConnected becomes true after onopen fires", async () => {
  const { result } = renderHook(() => useWebSocket("ws://localhost:8000/ws"));
  await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  expect(result.current.isConnected).toBe(true);
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd /Users/vitto/Desktop/music/frontend
npx vitest run src/hooks/useWebSocket.test.ts
```

Expected: `Cannot find module './useWebSocket'`

- [ ] **Step 3: Implement useWebSocket.ts**

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { UpdateMessage, WsOutMessage } from "../types";

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<UpdateMessage | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "update") setLastUpdate(msg as UpdateMessage);
    };
    return () => ws.close();
  }, [url]);

  const sendMessage = useCallback((msg: WsOutMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return { isConnected, lastUpdate, sendMessage };
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/hooks/useWebSocket.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add useWebSocket hook"
```

---

### Task 14: Chat Component

**Files:**
- Create: `frontend/src/components/Chat.tsx`
- Create: `frontend/src/components/Chat.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/Chat.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Chat } from "./Chat";

const msgs = [
  { role: "agent" as const, content: "Ciao! Cosa vuoi creare?" },
  { role: "user" as const, content: "qualcosa di rilassante" },
];

test("renders all messages", () => {
  render(<Chat messages={msgs} onSend={vi.fn()} isConnected={true} />);
  expect(screen.getByText("Ciao! Cosa vuoi creare?")).toBeInTheDocument();
  expect(screen.getByText("qualcosa di rilassante")).toBeInTheDocument();
});

test("calls onSend with trimmed text on submit", () => {
  const onSend = vi.fn();
  render(<Chat messages={[]} onSend={onSend} isConnected={true} />);
  const input = screen.getByPlaceholderText(/descrivi/i);
  fireEvent.change(input, { target: { value: "aggiungi basso " } });
  fireEvent.submit(input.closest("form")!);
  expect(onSend).toHaveBeenCalledWith("aggiungi basso");
});

test("disables input when disconnected", () => {
  render(<Chat messages={[]} onSend={vi.fn()} isConnected={false} />);
  expect(screen.getByPlaceholderText(/connessione/i)).toBeDisabled();
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/components/Chat.test.tsx
```

Expected: `Cannot find module './Chat'`

- [ ] **Step 3: Implement Chat.tsx**

```typescript
// frontend/src/components/Chat.tsx
import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isConnected: boolean;
}

export function Chat({ messages, onSend, isConnected }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isConnected) return;
    onSend(text);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            background: msg.role === "user" ? "#1a1a2a" : "#1a2a1a",
            color: msg.role === "user" ? "#9cf" : "#7c9",
            borderRadius: "8px", padding: "6px 12px",
            maxWidth: "80%", fontSize: "0.9rem",
          }}>
            {msg.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "6px", padding: "8px", borderTop: "1px solid #222" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isConnected ? "Descrivi cosa vuoi..." : "In attesa di connessione..."}
          disabled={!isConnected}
          style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: "6px", padding: "6px 10px", color: "#eee", fontSize: "0.9rem" }}
        />
        <button type="submit" disabled={!isConnected}
          style={{ background: "#2a4a2a", border: "none", borderRadius: "6px", padding: "6px 14px", color: "#7c9", cursor: "pointer" }}>
          →
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/components/Chat.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Chat.tsx frontend/src/components/Chat.test.tsx
git commit -m "feat: add Chat component"
```

---

### Task 15: KnobPanel Component

**Files:**
- Create: `frontend/src/components/KnobPanel.tsx`
- Create: `frontend/src/components/KnobPanel.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/KnobPanel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { KnobPanel } from "./KnobPanel";
import { Knob } from "../types";

const knobs: Knob[] = [
  { name: "BPM", strudel_param: "setcps", min: 0.5, max: 3.0, value: 1.4, color: "#fc9" },
  { name: "Filtro", strudel_param: "lpf", min: 200, max: 8000, value: 800, color: "#9cf" },
];

test("renders knob labels", () => {
  render(<KnobPanel knobs={knobs} onKnobChange={vi.fn()} />);
  expect(screen.getByText("BPM")).toBeInTheDocument();
  expect(screen.getByText("Filtro")).toBeInTheDocument();
});

test("shows empty state when no knobs", () => {
  render(<KnobPanel knobs={[]} onKnobChange={vi.fn()} />);
  expect(screen.getByText(/nessun knob/i)).toBeInTheDocument();
});

test("calls onKnobChange with param and parsed value", () => {
  const onChange = vi.fn();
  render(<KnobPanel knobs={knobs} onKnobChange={onChange} />);
  const sliders = screen.getAllByRole("slider");
  fireEvent.change(sliders[0], { target: { value: "2.0" } });
  expect(onChange).toHaveBeenCalledWith("setcps", 2.0);
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/components/KnobPanel.test.tsx
```

Expected: `Cannot find module './KnobPanel'`

- [ ] **Step 3: Implement KnobPanel.tsx**

```typescript
// frontend/src/components/KnobPanel.tsx
import { Knob } from "../types";

interface Props {
  knobs: Knob[];
  onKnobChange: (strudel_param: string, value: number) => void;
}

export function KnobPanel({ knobs, onKnobChange }: Props) {
  if (knobs.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#555", fontSize: "0.85rem", textAlign: "center" }}>
        Nessun knob disponibile — inizia a creare musica!
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", padding: "12px" }}>
      {knobs.map((knob) => (
        <div key={knob.strudel_param} style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: knob.color, marginBottom: "4px", fontWeight: "bold" }}>
            {knob.name}
          </div>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            border: `3px solid ${knob.color}`, margin: "0 auto 4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", color: knob.color,
          }}>
            {Number(knob.value).toFixed(1)}
          </div>
          <input
            type="range"
            role="slider"
            min={knob.min}
            max={knob.max}
            step={(knob.max - knob.min) / 100}
            value={knob.value}
            onChange={(e) => onKnobChange(knob.strudel_param, parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: knob.color }}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/components/KnobPanel.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/KnobPanel.tsx frontend/src/components/KnobPanel.test.tsx
git commit -m "feat: add KnobPanel component"
```

---

### Task 16: StrudelPlayer Component

**Files:**
- Create: `frontend/src/components/StrudelPlayer.tsx`
- Create: `frontend/src/components/StrudelPlayer.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/StrudelPlayer.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { StrudelPlayer } from "./StrudelPlayer";

vi.mock("@strudel/web", () => ({
  repl: vi.fn(() => ({
    evaluate: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getAudioContext: vi.fn(() => ({ destination: {} })),
  })),
}));

test("renders Play and Stop buttons", () => {
  render(<StrudelPlayer code="" onAudioNode={vi.fn()} />);
  expect(screen.getByText(/play/i)).toBeInTheDocument();
  expect(screen.getByText(/stop/i)).toBeInTheDocument();
});

test("shows code snippet in preview", () => {
  render(<StrudelPlayer code={'$: note("c3")'} onAudioNode={vi.fn()} />);
  expect(screen.getByText(/note/)).toBeInTheDocument();
});

test("Play button disabled when code is empty", () => {
  render(<StrudelPlayer code="" onAudioNode={vi.fn()} />);
  expect(screen.getByText(/play/i).closest("button")).toBeDisabled();
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/components/StrudelPlayer.test.tsx
```

Expected: `Cannot find module './StrudelPlayer'`

- [ ] **Step 3: Implement StrudelPlayer.tsx**

```typescript
// frontend/src/components/StrudelPlayer.tsx
import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
  onAudioNode: (node: AudioNode | null) => void;
}

export function StrudelPlayer({ code, onAudioNode }: Props) {
  const replRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    import("@strudel/web").then(({ repl }) => {
      if (active) replRef.current = repl({});
    });
    return () => { active = false; };
  }, []);

  // Re-evaluate live when code changes during playback
  useEffect(() => {
    if (isPlaying && replRef.current && code) {
      replRef.current.evaluate(code).catch((e: Error) => setError(e.message));
    }
  }, [code, isPlaying]);

  const handlePlay = async () => {
    setError(null);
    try {
      await replRef.current?.evaluate(code);
      setIsPlaying(true);
      const ctx = replRef.current?.getAudioContext?.();
      onAudioNode(ctx?.destination ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStop = () => {
    replRef.current?.stop();
    setIsPlaying(false);
    onAudioNode(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "#0a0a0a", padding: "6px 10px", borderRadius: "6px", color: "#7c9", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {code || "// nessun codice"}
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={handlePlay} disabled={isPlaying || !code}
          style={{ background: "#1a3a1a", border: "1px solid #2a5a2a", borderRadius: "6px", padding: "4px 12px", color: "#7c9", cursor: "pointer" }}>
          ▶ Play
        </button>
        <button onClick={handleStop} disabled={!isPlaying}
          style={{ background: "#2a1a1a", border: "1px solid #5a2a2a", borderRadius: "6px", padding: "4px 12px", color: "#f66", cursor: "pointer" }}>
          ⏹ Stop
        </button>
        {isPlaying && <span style={{ fontSize: "0.75rem", color: "#7c9" }}>● live</span>}
      </div>
      {error && <div style={{ color: "#f66", fontSize: "0.8rem" }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/components/StrudelPlayer.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StrudelPlayer.tsx frontend/src/components/StrudelPlayer.test.tsx
git commit -m "feat: add StrudelPlayer component"
```

---

### Task 17: Recorder Component

**Files:**
- Create: `frontend/src/components/Recorder.tsx`
- Create: `frontend/src/components/Recorder.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/components/Recorder.test.tsx
import { render, screen } from "@testing-library/react";
import { Recorder } from "./Recorder";

test("renders REC button", () => {
  render(<Recorder audioNode={null} />);
  expect(screen.getByText(/rec/i)).toBeInTheDocument();
});

test("REC button disabled when no audio node", () => {
  render(<Recorder audioNode={null} />);
  expect(screen.getByText(/rec/i).closest("button")).toBeDisabled();
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/components/Recorder.test.tsx
```

Expected: `Cannot find module './Recorder'`

- [ ] **Step 3: Implement Recorder.tsx**

```typescript
// frontend/src/components/Recorder.tsx
import { useRef, useState } from "react";

interface Props {
  audioNode: AudioNode | null;
}

export function Recorder({ audioNode }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const start = async () => {
    if (!audioNode) return;
    const dest = audioNode.context.createMediaStreamDestination();
    audioNode.connect(dest);
    const recorder = new MediaRecorder(dest.stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `performance-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  };

  const stop = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      {isRecording ? (
        <button onClick={stop}
          style={{ background: "#3a1a1a", border: "1px solid #8a2a2a", borderRadius: "6px", padding: "4px 12px", color: "#f66", cursor: "pointer" }}>
          ⏹ Stop REC
        </button>
      ) : (
        <button onClick={start} disabled={!audioNode}
          style={{ background: "#2a1a2a", border: "1px solid #5a2a5a", borderRadius: "6px", padding: "4px 12px", color: "#f9c", cursor: "pointer" }}>
          ⏺ REC
        </button>
      )}
      {isRecording && <span style={{ fontSize: "0.75rem", color: "#f66" }}>● registrazione</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/components/Recorder.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Recorder.tsx frontend/src/components/Recorder.test.tsx
git commit -m "feat: add Recorder component"
```

---

### Task 18: App Layout + Integration

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";

vi.mock("./hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    isConnected: false,
    lastUpdate: null,
    sendMessage: vi.fn(),
  }),
}));
vi.mock("./components/StrudelPlayer", () => ({
  StrudelPlayer: () => <div>MockPlayer</div>,
}));

test("renders player, knob panel, and chat", () => {
  render(<App />);
  expect(screen.getByText("MockPlayer")).toBeInTheDocument();
  expect(screen.getByText(/nessun knob/i)).toBeInTheDocument();
  expect(screen.getByText(/disconnesso/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/App.test.tsx
```

Expected: cannot find App export or missing mocked module

- [ ] **Step 3: Implement App.tsx**

```typescript
// frontend/src/App.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Chat } from "./components/Chat";
import { KnobPanel } from "./components/KnobPanel";
import { Recorder } from "./components/Recorder";
import { StrudelPlayer } from "./components/StrudelPlayer";
import { ChatMessage, Knob, UpdateMessage } from "./types";

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? "ws://localhost:8000/ws";

export function App() {
  const { isConnected, lastUpdate, sendMessage } = useWebSocket(WS_URL);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", content: "Ciao! Descrivi la musica che vuoi creare." },
  ]);
  const [knobs, setKnobs] = useState<Knob[]>([]);
  const [code, setCode] = useState("");
  const [audioNode, setAudioNode] = useState<AudioNode | null>(null);
  const lastUpdateRef = useRef<UpdateMessage | null>(null);

  useEffect(() => {
    if (!lastUpdate || lastUpdate === lastUpdateRef.current) return;
    lastUpdateRef.current = lastUpdate;
    setCode(lastUpdate.code);
    setKnobs(lastUpdate.knobs);
    if (lastUpdate.message) {
      setMessages(prev => [...prev, { role: "agent", content: lastUpdate.message }]);
    }
  }, [lastUpdate]);

  const handleSend = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: "user", content: text }]);
    sendMessage({ type: "user_message", message: text });
  }, [sendMessage]);

  const handleKnobChange = useCallback((strudel_param: string, value: number) => {
    setKnobs(prev => prev.map(k => k.strudel_param === strudel_param ? { ...k, value } : k));
    sendMessage({ type: "knob_change", knob_name: strudel_param, value });
  }, [sendMessage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0d0d0d", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      {/* Player + Knobs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #222", minHeight: "220px" }}>
        <div style={{ borderRight: "1px solid #222", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "0.7rem", color: "#555" }}>🎵 Strudel Player</div>
          <StrudelPlayer code={code} onAudioNode={setAudioNode} />
          <Recorder audioNode={audioNode} />
        </div>
        <div>
          <div style={{ padding: "8px 12px", fontSize: "0.7rem", color: "#555", borderBottom: "1px solid #1a1a1a" }}>
            🎛️ Knobs
          </div>
          <KnobPanel knobs={knobs} onKnobChange={handleKnobChange} />
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Chat messages={messages} onSend={handleSend} isConnected={isConnected} />
      </div>

      {/* Status bar */}
      <div style={{ padding: "3px 10px", fontSize: "0.65rem", color: isConnected ? "#7c9" : "#f66", background: "#111", borderTop: "1px solid #1a1a1a" }}>
        {isConnected ? "● connesso" : "○ disconnesso — avvia il backend"}
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/App.test.tsx
```

Expected: 1 test PASS.

- [ ] **Step 5: Run full frontend suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: assemble App layout"
```

---

## Phase 5: Verify

### Task 19: End-to-End Smoke Test

- [ ] **Step 1: Set API key and start backend**

```bash
cd /Users/vitto/Desktop/music/backend
source .venv/bin/activate
export ANTHROPIC_API_KEY=<your_key>
export LLM_MODEL=anthropic/claude-haiku-4-5-20251001
uvicorn main:app --reload --port 8000
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 2: Start frontend (new terminal)**

```bash
cd /Users/vitto/Desktop/music/frontend
npm run dev
```

Expected: `Local: http://localhost:5173`

- [ ] **Step 3: Verify connection**

Open `http://localhost:5173`. Status bar must show `● connesso`.

- [ ] **Step 4: Test track creation**

Send: `"voglio creare musica lofi rilassante con pianoforte"`

Expected:
- Agent responds with a description of the track
- Code appears in the player preview
- Knobs appear (at least BPM and one effect)

- [ ] **Step 5: Test knob interaction**

Move a slider. Backend must receive the `knob_change` message and return updated code within 5 seconds.

- [ ] **Step 6: Test recording**

Press ▶ Play → ⏺ REC → wait 5s → ⏹ Stop REC. A `.webm` file must download.

- [ ] **Step 7: Test creative mode**

Send: `"fai tu, sorprendimi"`. Agent must respond describing autonomous creative choices. New code must appear.

- [ ] **Step 8: Verify VS Code sync**

Open VS Code, check `/Users/vitto/Desktop/music/.strudel`. File must contain the latest generated code.

- [ ] **Step 9: Run coverage**

```bash
# Backend
cd /Users/vitto/Desktop/music/backend
python -m pytest ../tests/ -v --cov=backend --cov-report=term-missing
# Target: 80%+

# Frontend
cd /Users/vitto/Desktop/music/frontend
npx vitest run --coverage
# Target: 80%+
```

- [ ] **Step 10: Final commit**

```bash
cd /Users/vitto/Desktop/music
git add .
git commit -m "feat: music multi-agent system V1 complete"
```
