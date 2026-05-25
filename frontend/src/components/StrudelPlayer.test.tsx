import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { StrudelPlayer } from "./StrudelPlayer";

const {
  mockRepl, mockCompressor,
  mockLow, mockMid, mockHigh,
  mockDrive, mockConvolver, mockReverbWet,
  mockDelayNode, mockDelayFeedback, mockDelayWet,
  mockMasterVol, mockAnalyser,
  mockGainNode,
} = vi.hoisted(() => {
  const mockCompressor = {
    threshold: { value: 0 }, knee: { value: 0 },
    ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    connect: vi.fn(), disconnect: vi.fn(),
  };
  const mockLow = { type: "", frequency: { value: 0 }, gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockMid = { type: "", frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockHigh = { type: "", frequency: { value: 0 }, gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockDrive = { curve: null as any, oversample: "", connect: vi.fn(), disconnect: vi.fn() };
  const mockConvolver = { buffer: null as any, connect: vi.fn(), disconnect: vi.fn() };
  const mockReverbWet = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockDelayNode = { delayTime: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockDelayFeedback = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockDelayWet = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockMasterVol = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const mockAnalyser = { fftSize: 0, connect: vi.fn(), disconnect: vi.fn() };

  const mockGainNode = {
    disconnect: vi.fn(),
    connect: vi.fn(),
    context: {
      sampleRate: 44100,
      destination: {},
      createDynamicsCompressor: vi.fn(() => mockCompressor),
      createBiquadFilter: vi.fn()
        .mockReturnValueOnce(mockLow)
        .mockReturnValueOnce(mockMid)
        .mockReturnValueOnce(mockHigh),
      createWaveShaper: vi.fn(() => mockDrive),
      createConvolver: vi.fn(() => mockConvolver),
      createDelay: vi.fn(() => mockDelayNode),
      createGain: vi.fn()
        .mockReturnValueOnce(mockReverbWet)
        .mockReturnValueOnce(mockDelayFeedback)
        .mockReturnValueOnce(mockDelayWet)
        .mockReturnValueOnce(mockMasterVol),
      createAnalyser: vi.fn(() => mockAnalyser),
      createBuffer: vi.fn((ch: number, len: number, rate: number) => ({
        numberOfChannels: ch,
        length: len,
        sampleRate: rate,
        duration: len / rate,
        getChannelData: vi.fn(() => new Float32Array(len)),
      })),
    },
  };

  const mockRepl = {
    evaluate: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    state: { evalError: undefined as any },
  };

  return {
    mockRepl, mockCompressor,
    mockLow, mockMid, mockHigh,
    mockDrive, mockConvolver, mockReverbWet,
    mockDelayNode, mockDelayFeedback, mockDelayWet,
    mockMasterVol, mockAnalyser,
    mockGainNode,
  };
});

vi.mock("../lib/strudel-bundle", () => ({
  initStrudel: vi.fn().mockResolvedValue(mockRepl),
  samples: vi.fn().mockResolvedValue(undefined),
  getSuperdoughAudioController: vi.fn(() => ({
    output: { destinationGain: mockGainNode },
  })),
  registerSoundfonts: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  mockGainNode.context.createBiquadFilter
    .mockReset()
    .mockReturnValueOnce(mockLow)
    .mockReturnValueOnce(mockMid)
    .mockReturnValueOnce(mockHigh);
  mockGainNode.context.createDynamicsCompressor.mockReset().mockReturnValue(mockCompressor);
  mockGainNode.context.createWaveShaper.mockReset().mockReturnValue(mockDrive);
  mockGainNode.context.createConvolver.mockReset().mockReturnValue(mockConvolver);
  mockGainNode.context.createDelay.mockReset().mockReturnValue(mockDelayNode);
  mockGainNode.context.createGain
    .mockReset()
    .mockReturnValueOnce(mockReverbWet)
    .mockReturnValueOnce(mockDelayFeedback)
    .mockReturnValueOnce(mockDelayWet)
    .mockReturnValueOnce(mockMasterVol);
  mockGainNode.context.createAnalyser.mockReset().mockReturnValue(mockAnalyser);
  mockGainNode.disconnect.mockReset();
  mockGainNode.connect.mockReset();
  [mockCompressor, mockLow, mockMid, mockHigh, mockDrive, mockConvolver,
   mockReverbWet, mockDelayNode, mockDelayFeedback, mockDelayWet, mockMasterVol, mockAnalyser
  ].forEach(m => { (m as any).disconnect?.mockReset(); });
  mockCompressor.threshold.value = 0;
  mockCompressor.ratio.value = 0;
  mockRepl.evaluate.mockReset().mockResolvedValue(undefined);
  mockRepl.stop.mockReset();
  mockRepl.state.evalError = undefined;
});

afterEach(() => {
  cleanup();
});

test("renders Play and Stop buttons", () => {
  render(<StrudelPlayer code="" onAudioNode={vi.fn()} />);
  expect(screen.getByText(/play/i)).toBeInTheDocument();
  expect(screen.getByText(/stop/i)).toBeInTheDocument();
});

test("Play button is enabled when code is provided", () => {
  render(<StrudelPlayer code={'$: note("c3")'} onAudioNode={vi.fn()} />);
  expect(screen.getByText(/play/i).closest("button")).not.toBeDisabled();
});

test("Play button disabled when code is empty", () => {
  render(<StrudelPlayer code="" onAudioNode={vi.fn()} />);
  expect(screen.getByText(/play/i).closest("button")).toBeDisabled();
});

test("calls evaluate when Play button is clicked with code", async () => {
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} />);
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  const playBtn = screen.getByText(/play/i).closest("button")!;
  expect(playBtn).not.toBeDisabled();
  fireEvent.click(playBtn);
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  expect(mockRepl.evaluate).toHaveBeenCalledWith('$: note("c3")');
});

test("calls stop when Stop button is clicked", async () => {
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} />);
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  const playBtn = screen.getByText(/play/i).closest("button")!;
  fireEvent.click(playBtn);
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  const stopBtn = screen.getByText(/stop/i).closest("button")!;
  fireEvent.click(stopBtn);
  expect(mockRepl.stop).toHaveBeenCalled();
});

test("creates compressor with correct settings after play", async () => {
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} />);
  await act(async () => { fireEvent.click(screen.getByText(/play/i).closest("button")!); });
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
  expect(mockGainNode.context.createDynamicsCompressor).toHaveBeenCalled();
  expect(mockCompressor.threshold.value).toBe(-12);
  expect(mockCompressor.ratio.value).toBe(4);
});

test("calls onAudioFxNodes with all node types after play", async () => {
  const onAudioFxNodes = vi.fn();
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} onAudioFxNodes={onAudioFxNodes} />);
  await act(async () => { fireEvent.click(screen.getByText(/play/i).closest("button")!); });
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
  expect(onAudioFxNodes).toHaveBeenCalledWith(expect.objectContaining({
    low: mockLow,
    mid: mockMid,
    high: mockHigh,
    drive: mockDrive,
    reverbWet: mockReverbWet,
    delayNode: mockDelayNode,
    delayWet: mockDelayWet,
    masterVol: mockMasterVol,
  }));
});

test("calls onAudioFxNodes with null on stop", async () => {
  const onAudioFxNodes = vi.fn();
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} onAudioFxNodes={onAudioFxNodes} />);
  await act(async () => { fireEvent.click(screen.getByText(/play/i).closest("button")!); });
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
  onAudioFxNodes.mockClear();
  fireEvent.click(screen.getByText(/stop/i).closest("button")!);
  expect(onAudioFxNodes).toHaveBeenCalledWith(null);
});

test("does not call evaluate on code change if not playing", async () => {
  const { rerender } = render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} />);
  rerender(<StrudelPlayer code='$: note("e3")' onAudioNode={vi.fn()} />);
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
  expect(mockRepl.evaluate).not.toHaveBeenCalledWith('$: note("e3")');
});

test("shows PENDING indicator while debounce is active", async () => {
  vi.useFakeTimers();
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} />);
  await act(async () => { fireEvent.click(screen.getByText(/play/i).closest("button")!); });
  await act(async () => { await vi.runAllTimersAsync(); });
  vi.useRealTimers();
});

test("evaluateNowRef calls evaluate immediately", async () => {
  const evaluateNowRef = { current: null as ((c: string) => void) | null };
  render(<StrudelPlayer code='$: note("c3")' onAudioNode={vi.fn()} evaluateNowRef={evaluateNowRef} />);
  await act(async () => { fireEvent.click(screen.getByText(/play/i).closest("button")!); });
  await act(async () => { await new Promise(r => setTimeout(r, 100)); });
  mockRepl.evaluate.mockClear();
  act(() => { evaluateNowRef.current?.('$: note("g3")'); });
  expect(mockRepl.evaluate).toHaveBeenCalledWith('$: note("g3")');
});
