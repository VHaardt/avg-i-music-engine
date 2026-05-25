from unittest.mock import MagicMock, patch


def _make_response(content: str):
    m = MagicMock()
    m.choices[0].message.content = content
    return m


def test_error_recovery_returns_fixed_code():
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    state = create_initial_state()
    state["strudel_code"] = "note('c3').s('nonexistent_sample_xyz')"
    state["last_runtime_error"] = "Unknown sample: nonexistent_sample_xyz"
    state["conversation_history"] = [{"role": "user", "content": "make a piano note"}]

    with patch(
        "backend.agents.error_recovery_agent.llm_call",
        return_value=_make_response("```javascript\nnote('c3').s('piano')\n```"),
    ):
        result = error_recovery_agent(state)

    assert "strudel_code" in result
    assert result["strudel_code"] == "note('c3').s('piano')"


def test_error_recovery_receives_error_in_prompt():
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    captured = []

    def fake_llm(agent, **kwargs):
        captured.extend(kwargs.get("messages", []))
        return _make_response("```javascript\nnote('c3')\n```")

    state = create_initial_state()
    state["strudel_code"] = "broken_code()"
    state["last_runtime_error"] = "ReferenceError: broken_code is not defined"
    state["conversation_history"] = [{"role": "user", "content": "test"}]

    with patch("backend.agents.error_recovery_agent.llm_call", side_effect=fake_llm):
        error_recovery_agent(state)

    user_msg = next(m["content"] for m in captured if m["role"] == "user")
    assert "ReferenceError" in user_msg
    assert "broken_code" in user_msg


def test_error_recovery_clears_runtime_error():
    from backend.agents.error_recovery_agent import error_recovery_agent
    from backend.state import create_initial_state

    state = create_initial_state()
    state["strudel_code"] = "bad()"
    state["last_runtime_error"] = "some error"
    state["conversation_history"] = [{"role": "user", "content": "x"}]

    with patch(
        "backend.agents.error_recovery_agent.llm_call",
        return_value=_make_response("```javascript\nnote('c3')\n```"),
    ):
        result = error_recovery_agent(state)

    assert result.get("last_runtime_error") == ""
