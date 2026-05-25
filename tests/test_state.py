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
    knob = KnobConfig(name="BPM", strudel_param="setcps", min=0.5, max=3.0, value=1.4, color="#fc9")
    assert knob.name == "BPM"
    assert knob.min == 0.5
    assert knob.color == "#fc9"
