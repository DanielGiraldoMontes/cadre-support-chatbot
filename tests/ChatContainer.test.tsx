import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatContainer } from "@/components/chat/ChatContainer";

function jsonResponse(ok: boolean, body: unknown, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderReady() {
  render(<ChatContainer />);
  // Check the input, not the Send button: the button is disabled both by
  // the `disabled` prop AND by an empty value (Composer.tsx), so it stays
  // disabled regardless of readiness until text is typed. The input's
  // disabled state reflects only the `disabled` prop.
  await waitFor(() => expect(screen.getByLabelText("Message")).not.toBeDisabled());
}

describe("ChatContainer", () => {
  it("shows starter prompts and sends a message on click", async () => {
    let postCalled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init) {
          postCalled = true;
          return Promise.resolve(
            jsonResponse(true, { reply: "Cadre AI is a consultancy.", escalated: false }),
          );
        }
        return Promise.resolve(jsonResponse(true, { messages: [] }));
      }),
    );

    await renderReady();

    fireEvent.click(await screen.findByText("What does Cadre AI do?"));

    expect(await screen.findByText("Cadre AI is a consultancy.")).toBeInTheDocument();
    expect(postCalled).toBe(true);
  });

  it("shows a loading indicator while waiting for a response", async () => {
    let resolvePost: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init) {
          return new Promise<Response>((resolve) => {
            resolvePost = resolve;
          });
        }
        return Promise.resolve(jsonResponse(true, { messages: [] }));
      }),
    );

    await renderReady();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByLabelText("Assistant is typing")).toBeInTheDocument();

    resolvePost(jsonResponse(true, { reply: "done", escalated: false }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Assistant is typing")).not.toBeInTheDocument(),
    );
  });

  it("shows a friendly error state when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init) {
          return Promise.resolve(
            jsonResponse(
              false,
              { error: "rate_limited", message: "Please try again in a bit." },
              429,
            ),
          );
        }
        return Promise.resolve(jsonResponse(true, { messages: [] }));
      }),
    );

    await renderReady();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again in a bit.");
  });

  it("renders an escalated reply distinctly from a normal reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init) {
          return Promise.resolve(
            jsonResponse(true, { reply: "I don't have enough verified information.", escalated: true }),
          );
        }
        return Promise.resolve(jsonResponse(true, { messages: [] }));
      }),
    );

    await renderReady();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "random question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const bubble = await screen.findByText("I don't have enough verified information.");
    expect(bubble.closest('[data-testid="message-bubble"]')).toHaveAttribute(
      "data-escalated",
      "true",
    );
  });
});
