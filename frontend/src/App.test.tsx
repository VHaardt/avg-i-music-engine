import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi } from "vitest";
import { App, DEFAULT_CODE } from "./App";

const mockSendMessage = vi.fn();
let mockIsConnected = false;
let mockLastUpdate: any = null;

vi.mock("./hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    isConnected: mockIsConnected,
    lastUpdate: mockLastUpdate,
    sendMessage: mockSendMessage,
  }),
}));
vi.mock("./components/StrudelPlayer", () => ({
  StrudelPlayer: () => <div>MockPlayer</div>,
}));
vi.mock("./components/Waveform", () => ({
  Waveform: () => <div>MockWaveform</div>,
}));
vi.mock("./components/BpmEqPanel", () => ({
  BpmEqPanel: () => <div>MockBpmEq</div>,
}));
vi.mock("./components/PresetStrip", () => ({
  PresetStrip: () => <div>MockPresetStrip</div>,
}));

beforeEach(() => {
  mockIsConnected = false;
  mockLastUpdate = null;
  mockSendMessage.mockClear();
});

test("renders player, knob panel, and chat", () => {
  render(<App />);
  expect(screen.getByText("MockPlayer")).toBeInTheDocument();
  expect(screen.getByText(/nessun knob/i)).toBeInTheDocument();
  expect(screen.getByText(/offline/i)).toBeInTheDocument();
});

test("displays initial greeting message", () => {
  render(<App />);
  expect(screen.getByText(/ciao.*descrivi/i)).toBeInTheDocument();
});

test("input is disabled when not connected", () => {
  render(<App />);
  const input = screen.getByPlaceholderText(/in attesa/i) as HTMLInputElement;
  expect(input.disabled).toBe(true);
});

test("handleSend adds user message and calls sendMessage", () => {
  mockIsConnected = true;
  render(<App />);
  const input = screen.getByPlaceholderText(/descrivi/i);
  fireEvent.change(input, { target: { value: "aggiungi un basso" } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByText("aggiungi un basso")).toBeInTheDocument();
  expect(mockSendMessage).toHaveBeenCalledWith({
    type: "user_message",
    message: "aggiungi un basso",
    current_code: DEFAULT_CODE,
    manually_edited: true,
    queued_slot: null,
  });
});

test("lastUpdate effect adds agent message and updates code", async () => {
  const update = {
    type: "update" as const,
    code: '$: note("c3")',
    knobs: [{ name: "BPM", strudel_param: "setcps", min: 0.5, max: 3.0, value: 1.4, color: "#fc9" }],
    message: "Ho aggiunto un basso!",
    creative_mode: false,
  };
  mockLastUpdate = update;
  render(<App />);
  // Wait for typewriter animation to complete
  await screen.findByText("Ho aggiunto un basso!", {}, { timeout: 3000 });
  expect(screen.getByText("BPM")).toBeInTheDocument();
});

test("handleKnobChange updates code directly without calling sendMessage", async () => {
  mockIsConnected = true;
  mockLastUpdate = {
    type: "update" as const,
    code: '$: note("c3").setcps(1.4)',
    knobs: [{ name: "BPM", strudel_param: "setcps", min: 0.5, max: 3.0, value: 1.4, color: "#fc9" }],
    message: "",
    creative_mode: false,
  };
  render(<App />);
  await act(async () => {});
  const slider = screen.getByRole("slider");
  fireEvent.change(slider, { target: { value: "2.0" } });
  expect(mockSendMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: "knob_change" })
  );
});
