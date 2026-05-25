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
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm("Ho aggiunto un basso morbido! Vuoi rallentare ancora?")
        result = response_agent(state)
    assert result["agent_message"] == "Ho aggiunto un basso morbido! Vuoi rallentare ancora?"

def test_response_agent_returns_non_empty_string():
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "ciao"}]
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm("Ciao! Cosa vuoi creare oggi?")
        result = response_agent(state)
    assert isinstance(result["agent_message"], str)
    assert len(result["agent_message"]) > 0
