import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Recorder, encodeWav } from "./Recorder";

const mockAudioNode = {
  connect: vi.fn(),
  context: {
    createMediaStreamDestination: vi.fn(() => ({ stream: {} })),
  },
} as unknown as AudioNode;

test("renders REC button", () => {
  render(<Recorder audioNode={null} />);
  expect(screen.getByText(/rec/i)).toBeInTheDocument();
});

test("REC button disabled when no audio node", () => {
  render(<Recorder audioNode={null} />);
  expect(screen.getByText(/rec/i).closest("button")).toBeDisabled();
});

test("REC button enabled when audio node provided", () => {
  render(<Recorder audioNode={mockAudioNode} />);
  expect(screen.getByText(/rec/i).closest("button")).not.toBeDisabled();
});

test("encodeWav returns Blob with RIFF header", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1.0]);
  const blob = encodeWav([samples], 44100, 1);
  expect(blob.type).toBe("audio/wav");
  expect(blob.size).toBeGreaterThan(44);
});

test("encodeWav blob starts with RIFF identifier", async () => {
  const samples = new Float32Array([0, 0.5]);
  const blob = encodeWav([samples], 44100, 1);
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  expect(view.getUint32(0, false)).toBe(0x52494646); // "RIFF"
  expect(view.getUint32(8, false)).toBe(0x57415645); // "WAVE"
});

