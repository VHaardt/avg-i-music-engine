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
    with patch("backend.llm_utils.litellm.completion") as m:
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
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm('{"mood":"melancholic","key":"a_minor"}')
        result = music_expert_agent(state)
    assert result["musical_context"]["bpm"] == 120
    assert result["musical_context"]["mood"] == "melancholic"
