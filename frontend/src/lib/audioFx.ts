export function makeReverbIR(
  ctx: BaseAudioContext,
  duration: number,
  decay: number
): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * duration);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function makeDriveCurve(amount: number): Float32Array {
  const n = 512;
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = k === 0
      ? x
      : ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
