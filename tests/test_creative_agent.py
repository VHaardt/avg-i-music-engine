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
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(ADVISOR_RESP)
        result = creative_agent(state)
    assert "creative_suggestions" in result
    assert len(result["creative_suggestions"]) == 2

def test_creative_agent_autonomous_updates_musical_context():
    state = create_initial_state()
    state["creative_mode"] = True
    state["conversation_history"] = [{"role": "user", "content": "fai tu"}]
    state["strudel_code"] = '$: note("c3 e3 g3").slow(2)'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(AUTONOMOUS_RESP)
        result = creative_agent(state)
    assert result["musical_context"]["bpm"] == 95
    assert result["musical_context"]["mood"] == "melancholic"
