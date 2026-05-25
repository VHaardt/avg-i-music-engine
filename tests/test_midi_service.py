from unittest.mock import MagicMock, patch


def test_get_ports_returns_list(mocker):
    from backend.midi_service import MidiOutputService

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1", "IAC Bus 2"]

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        ports = svc.get_ports()

    assert isinstance(ports, list)
    assert "IAC Bus 1" in ports


def test_service_starts_and_stops(mocker):
    from backend.midi_service import MidiOutputService
    import time

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1"]
    mock_midiout.is_port_open.return_value = True

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        svc.start(port_index=0, bpm=120.0)
        time.sleep(0.1)
        svc.stop()

    assert mock_midiout.send_message.called


def test_set_bpm_updates_interval(mocker):
    from backend.midi_service import MidiOutputService

    mock_midiout = MagicMock()
    mock_midiout.get_ports.return_value = ["IAC Bus 1"]
    mock_midiout.is_port_open.return_value = True

    with patch("backend.midi_service.rtmidi.MidiOut", return_value=mock_midiout):
        svc = MidiOutputService()
        svc.start(port_index=0, bpm=120.0)
        svc.set_bpm(140.0)
        assert abs(svc._interval - 60.0 / (140.0 * 24)) < 1e-9
        svc.stop()
