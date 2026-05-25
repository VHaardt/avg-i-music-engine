from unittest.mock import patch, MagicMock
from backend.state import create_initial_state
from backend.agents.knobs_agent import knobs_agent, _param_in_code, _extract_value, _inject_param


def _mock_llm(json_str: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = json_str
    return mock


KNOBS_JSON = '[{"name":"Reverb","strudel_param":"room","min":0,"max":2,"value":0.5,"color":"#7c9"},{"name":"Filtro","strudel_param":"lpf","min":200,"max":8000,"value":800,"color":"#9cf"}]'


# ── unit helpers ──────────────────────────────────────────────────────────────

def test_param_in_code_true():
    assert _param_in_code('$: note("c3").setcps(1.4)', "setcps") is True

def test_param_in_code_false():
    assert _param_in_code('$: note("c3")', "setcps") is False

def test_extract_value_found():
    assert _extract_value('$: note("c3").lpf(800)', "lpf") == 800.0

def test_extract_value_not_found():
    assert _extract_value('$: note("c3")', "lpf") is None

def test_inject_param_appends_to_strudel_line():
    code = '$: note("c3").slow(2)'
    result = _inject_param(code, "setcps", 1.4)
    # setcps is top-level: injected as standalone at top, not chained
    assert result.startswith("setcps(1.4)")

def test_inject_param_no_pattern_line():
    code = "// only a comment"
    result = _inject_param(code, "gain", 0.8)
    assert ".gain(0.8)" in result


# ── integration ───────────────────────────────────────────────────────────────

def test_knobs_agent_returns_list():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3 e3").room(0.5).lpf(800)'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    assert isinstance(result["active_knobs"], list)
    assert len(result["active_knobs"]) == 2


def test_knobs_agent_knob_has_required_fields():
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").room(0.5).lpf(800)'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    for field in ["name", "strudel_param", "min", "max", "value", "color"]:
        assert field in result["active_knobs"][0], f"Missing: {field}"


def test_knobs_agent_returns_empty_for_no_code():
    state = create_initial_state()
    result = knobs_agent(state)
    assert result["active_knobs"] == []


def test_knobs_agent_syncs_value_from_code():
    """Knob value must match what's actually in the code, not the LLM suggestion."""
    state = create_initial_state()
    # Code has lpf(2000), LLM suggests lpf with value 800 — code wins
    state["strudel_code"] = '$: note("c3").room(0.5).lpf(2000)'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    lpf_knob = next(k for k in result["active_knobs"] if k["strudel_param"] == "lpf")
    assert lpf_knob["value"] == 2000.0


def test_knobs_agent_injects_missing_param():
    """If LLM suggests a param absent from code, inject it so the knob works."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(800)'  # no room
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    # room injected as chained method
    assert ".room(" in result["strudel_code"]
    assert len(result["active_knobs"]) == 2


def test_knobs_agent_returns_updated_code():
    """When params are injected, strudel_code in result must be updated."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3")'  # no room, no lpf
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(KNOBS_JSON)
        result = knobs_agent(state)
    assert "strudel_code" in result
    assert ".room(" in result["strudel_code"]
    assert ".lpf(" in result["strudel_code"]


# ── coherence: dedup, BPM exclusion, canonical ranges ─────────────────────────

def test_knobs_agent_deduplicates_aliases():
    """lpf and cutoff are aliases — only one should survive."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").lpf(800).cutoff(800)'
    json_with_aliases = '[{"name":"LPF","strudel_param":"lpf","min":80,"max":12000,"value":800,"color":"#9cf"},{"name":"Cutoff","strudel_param":"cutoff","min":80,"max":12000,"value":800,"color":"#9cf"}]'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(json_with_aliases)
        result = knobs_agent(state)
    params = [k["strudel_param"] for k in result["active_knobs"]]
    assert len(params) == len(set(params)), "Duplicate alias knobs returned"
    assert len(result["active_knobs"]) == 1


def test_knobs_agent_excludes_bpm_params():
    """BPM params must be excluded — handled by the dedicated BPM knob in the UI."""
    state = create_initial_state()
    state["strudel_code"] = 'setcpm(30)\n$: note("c3").lpf(800)'
    bpm_json = '[{"name":"BPM","strudel_param":"setcpm","min":10,"max":200,"value":30,"color":"#fc9"},{"name":"LPF","strudel_param":"lpf","min":80,"max":12000,"value":800,"color":"#9cf"}]'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(bpm_json)
        result = knobs_agent(state)
    params = [k["strudel_param"] for k in result["active_knobs"]]
    assert "setcpm" not in params
    assert "cpm" not in params


def test_knobs_agent_clamps_room_to_canonical_range():
    """room must be clamped to 0–2 regardless of what LLM returns."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").room(1.2)'
    bad_range_json = '[{"name":"Room","strudel_param":"room","min":0,"max":100,"value":1.2,"color":"#7c9"}]'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(bad_range_json)
        result = knobs_agent(state)
    room_knob = next(k for k in result["active_knobs"] if k["strudel_param"] == "room")
    assert room_knob["max"] <= 2
    assert room_knob["min"] >= 0


def test_knobs_agent_clamps_gain_to_canonical_range():
    """gain must be clamped to 0–1.5 regardless of what LLM returns."""
    state = create_initial_state()
    state["strudel_code"] = '$: note("c3").gain(0.8)'
    bad_range_json = '[{"name":"Gain","strudel_param":"gain","min":0,"max":10,"value":0.8,"color":"#f9c"}]'
    with patch("backend.llm_utils.litellm.completion") as m:
        m.return_value = _mock_llm(bad_range_json)
        result = knobs_agent(state)
    gain_knob = next(k for k in result["active_knobs"] if k["strudel_param"] == "gain")
    assert gain_knob["max"] <= 1.5
