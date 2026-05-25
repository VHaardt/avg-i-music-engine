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
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(NEW_CODE)
        result = strudel_coder_agent(state)
    assert result["strudel_code"] == NEW_CODE

def test_strudel_coder_handles_knob_change():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(400)'
    state["conversation_history"] = [{"role": "user", "content": "[KNOB] lpf=800"}]
    updated = '$: note("c3").lpf(800)'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(updated)
        result = strudel_coder_agent(state)
    assert result["strudel_code"] == updated


def test_strudel_coder_includes_current_code_in_user_prompt():
    """When state has existing code, it must appear in the user message."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(800)  // existing'
    state["musical_context"] = {"intent": "add reverb"}

    captured_messages = []

    def capture_llm(**kwargs):
        captured_messages.extend(kwargs.get("messages", []))
        mock = MagicMock()
        mock.choices[0].message.content = '$: note("c3").lpf(800).room(1.2)'
        return mock

    with patch("backend.llm_utils.litellm.completion", side_effect=capture_llm):
        strudel_coder_agent(state)

    user_content = next(m["content"] for m in captured_messages if m["role"] == "user")
    assert '$: note("c3").lpf(800)' in user_content, "Current code not passed in user prompt"


def test_strudel_coder_prompt_mentions_surgical_edit_when_code_present():
    """The user prompt must contain surgical-edit instruction when code is non-empty."""
    state = create_initial_state()
    state["strudel_code"] = '$: sound("bd")'
    state["musical_context"] = {}

    captured_messages = []

    def capture_llm(**kwargs):
        captured_messages.extend(kwargs.get("messages", []))
        mock = MagicMock()
        mock.choices[0].message.content = '$: sound("bd").room(1)'
        return mock

    with patch("backend.llm_utils.litellm.completion", side_effect=capture_llm):
        strudel_coder_agent(state)

    all_content = " ".join(m["content"] for m in captured_messages)
    assert any(word in all_content.lower() for word in ["surgical", "modify", "modifica"]), \
        "No surgical-edit instruction found in prompt"


def test_strudel_coder_includes_available_samples_in_prompt():
    """System prompt must mention available samples so AI stops inventing them."""
    captured_messages = []

    def fake_llm_call(agent, **kwargs):
        captured_messages.extend(kwargs.get("messages", []))
        m = MagicMock()
        m.choices[0].message.content = "```javascript\nnote('c3').s('piano')\n```"
        return m

    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "make a piano note"}]

    with patch("backend.agents.strudel_coder.llm_call", side_effect=fake_llm_call):
        strudel_coder_agent(state)

    system_content = next(m["content"] for m in captured_messages if m["role"] == "system")
    assert "piano" in system_content
    assert "bd" in system_content
