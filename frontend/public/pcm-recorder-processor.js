class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this.port.onmessage = (e) => {
      if (e.data === "start") this._recording = true;
      if (e.data === "stop") this._recording = false;
    };
  }

  process(inputs) {
    if (!this._recording) return true;
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const left = input[0] ?? new Float32Array(128);
    const right = input[1] ?? left;
    this.port.postMessage({ left: left.slice(), right: right.slice() });
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PcmRecorderProcessor);
