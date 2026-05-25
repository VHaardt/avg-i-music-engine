import { describe, expect, test, beforeEach } from "vitest";
import { makeReverbIR, makeDriveCurve } from "./audioFx";

describe("makeReverbIR", () => {
  let ctx: OfflineAudioContext;
  beforeEach(() => { ctx = new OfflineAudioContext(2, 44100, 44100); });

  test("returns AudioBuffer with correct duration", () => {
    const buf = makeReverbIR(ctx, 1.5, 3);
    expect(buf.duration).toBeCloseTo(1.5, 1);
    expect(buf.numberOfChannels).toBe(2);
  });

  test("IR data is non-zero", () => {
    const buf = makeReverbIR(ctx, 0.5, 2);
    const data = buf.getChannelData(0);
    expect(data.some(v => v !== 0)).toBe(true);
  });
});

describe("makeDriveCurve", () => {
  test("returns Float32Array of length 512", () => {
    const curve = makeDriveCurve(0.5);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(512);
  });

  test("drive=0 produces near-identity curve", () => {
    const curve = makeDriveCurve(0);
    expect(Math.abs(curve[256])).toBeLessThan(0.05);
    expect(curve[511]).toBeCloseTo(1, 0);
  });

  test("drive=1 clips more aggressively than drive=0", () => {
    const soft = makeDriveCurve(0);
    const hard = makeDriveCurve(1);
    expect(hard[384]).toBeGreaterThan(soft[384]);
  });
});
