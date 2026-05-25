import threading
import time
from typing import Optional

import rtmidi

from backend.logger import logger

MIDI_CLOCK = 0xF8
MIDI_START = 0xFA
MIDI_STOP = 0xFC


class MidiOutputService:
    def __init__(self) -> None:
        self._midiout: Optional[rtmidi.MidiOut] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._bpm = 120.0
        self._interval = 60.0 / (120.0 * 24)
        self._lock = threading.Lock()

    def get_ports(self) -> list[str]:
        tmp = rtmidi.MidiOut()
        ports = tmp.get_ports()
        del tmp
        return ports

    def start(self, port_index: int, bpm: float) -> None:
        self.stop()
        self._bpm = bpm
        self._interval = 60.0 / (bpm * 24)
        self._midiout = rtmidi.MidiOut()
        ports = self._midiout.get_ports()
        if not ports:
            logger.warning("[midi] no MIDI output ports available")
            self._midiout = None
            return
        idx = min(port_index, len(ports) - 1)
        self._midiout.open_port(idx)
        self._midiout.send_message([MIDI_START])
        self._running = True
        self._thread = threading.Thread(target=self._clock_loop, daemon=True)
        self._thread.start()
        logger.info(f"[midi] started on port {ports[idx]!r} @ {bpm} BPM")

    def set_bpm(self, bpm: float) -> None:
        with self._lock:
            self._bpm = bpm
            self._interval = 60.0 / (bpm * 24)

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
            self._thread = None
        if self._midiout and self._midiout.is_port_open():
            self._midiout.send_message([MIDI_STOP])
            self._midiout.close_port()
        self._midiout = None
        logger.info("[midi] stopped")

    def _clock_loop(self) -> None:
        while self._running:
            with self._lock:
                interval = self._interval
            if self._midiout and self._midiout.is_port_open():
                self._midiout.send_message([MIDI_CLOCK])
            time.sleep(interval)


_service = MidiOutputService()


def get_midi_service() -> MidiOutputService:
    return _service
