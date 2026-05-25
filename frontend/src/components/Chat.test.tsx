import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Chat } from "./Chat";

const msgs = [
  { role: "agent" as const, content: "Ciao! Cosa vuoi creare?" },
  { role: "user" as const, content: "qualcosa di rilassante" },
];

test("renders all messages", () => {
  render(<Chat messages={msgs} onSend={vi.fn()} isConnected={true} />);
  expect(screen.getByText("Ciao! Cosa vuoi creare?")).toBeInTheDocument();
  expect(screen.getByText("qualcosa di rilassante")).toBeInTheDocument();
});

test("calls onSend with trimmed text on submit", () => {
  const onSend = vi.fn();
  render(<Chat messages={[]} onSend={onSend} isConnected={true} />);
  const input = screen.getByPlaceholderText(/descrivi/i);
  fireEvent.change(input, { target: { value: "aggiungi basso " } });
  fireEvent.submit(input.closest("form")!);
  expect(onSend).toHaveBeenCalledWith("aggiungi basso");
});

test("disables input when disconnected", () => {
  render(<Chat messages={[]} onSend={vi.fn()} isConnected={false} />);
  expect(screen.getByPlaceholderText(/connessione/i)).toBeDisabled();
});
