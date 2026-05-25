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
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(
            '{"intent":"modify_track","next_agents":["music_expert","strudel_coder","knobs_agent","response_agent"]}'
        )
        result = supervisor_agent(state)
    assert result["user_intent"] == "modify_track"
    assert "music_expert" in result["next_agents"]

def test_supervisor_routes_knob_change():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "[KNOB] lpf=800"}]
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm('{"intent":"move_knob","next_agents":["strudel_coder"]}')
        result = supervisor_agent(state)
    assert result["user_intent"] == "move_knob"
    assert result["next_agents"] == ["strudel_coder"]

def test_supervisor_sets_creative_mode_on_autonomous():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "fai tu, sorprendimi"}]
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(
            '{"intent":"creative_autonomous","next_agents":["creative_agent","strudel_coder","knobs_agent","response_agent"]}'
        )
        result = supervisor_agent(state)
    assert result["user_intent"] == "creative_autonomous"
    assert result["creative_mode"] is True
