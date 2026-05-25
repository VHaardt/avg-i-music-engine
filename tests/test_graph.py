from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.graph import build_graph


def _mk(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    m = MagicMock()
    m.choices = [choice]
    return m


def test_graph_builds():
    graph = build_graph()
    assert graph is not None


def test_runtime_error_routes_to_error_recovery():
    """When user_intent is pre-set to runtime_error, graph bypasses supervisor."""
    graph = build_graph()
    state = create_initial_state()
    state["strudel_code"] = "broken()"
    state["last_runtime_error"] = "broken is not defined"
    state["user_intent"] = "runtime_error"
    state["conversation_history"] = [{"role": "user", "content": "[RUNTIME_ERROR] broken is not defined"}]

    recovery_calls = []

    def fake_recovery_llm(agent, **kwargs):
        recovery_calls.append(True)
        return _mk("```javascript\nnote('c3')\n```")

    with (
        patch("backend.agents.error_recovery_agent.llm_call", side_effect=fake_recovery_llm),
        patch("backend.agents.response_agent.llm_call", return_value=_mk("Fixed!")),
    ):
        result = graph.invoke(state)

    assert len(recovery_calls) > 0, "error_recovery_agent must be called"
    assert result.get("last_runtime_error") == ""


def test_graph_modify_track_flow():
    graph = build_graph()
    state = create_initial_state()
    state["conversation_history"] = [{"role": "user", "content": "aggiungi percussioni"}]

    # Responses in call order: supervisor, music_expert, strudel_coder, knobs_agent, response_agent
    responses = [
        '{"intent":"modify_track","next_agents":["music_expert","strudel_coder","knobs_agent","response_agent"]}',
        '{"bpm":120,"mood":"energetic"}',
        '$: sound("bd").fast(2)',
        '[{"name":"Room","strudel_param":"room","min":0.0,"max":1.0,"value":0.3,"color":"#fc9"}]',
        "Ho aggiunto le percussioni!",
    ]
    call_count = [0]

    def side_effect(*args, **kwargs):
        i = call_count[0]
        call_count[0] += 1
        return _mk(responses[i])

    with patch("litellm.completion", side_effect=side_effect):
        result = graph.invoke(state)

    # knobs_agent may inject missing params into the code
    assert '$: sound("bd").fast(2)' in result["strudel_code"]
    assert result["agent_message"] == "Ho aggiunto le percussioni!"
    assert len(result["active_knobs"]) == 1
