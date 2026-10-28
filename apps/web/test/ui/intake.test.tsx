// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { applyProposal, DEMO_EXAMPLE_SENTENCE, readIntakeReply, withAnswer } from "../../src/intakeFlow";
import { RoomForm } from "../../src/ui/RoomForm";

const TRACES = join(__dirname, "../../../../fixtures/agent/intake");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => push.mockReset());

describe("intakeFlow", () => {
  it("the demo example sentence is one of the recorded traces", () => {
    const inputs = readdirSync(TRACES)
      .filter((f) => f.endsWith(".json"))
      .map((f) => (JSON.parse(readFileSync(join(TRACES, f), "utf8")) as { input: string }).input);
    expect(inputs).toContain(DEMO_EXAMPLE_SENTENCE);
  });

  it("fills a complete room and says nothing is ranked yet", () => {
    const applied = applyProposal(
      { city: "", crowd: [], candidates: [] },
      { city: "Leipzig", crowdActs: ["Moderat", "Apparat", "Modeselektor"], candidateActs: ["Khruangbin", "Radiohead", "Reality Club"] },
    );
    expect(applied).toMatchObject({ city: "Leipzig", complete: true, crowd: ["Moderat", "Apparat", "Modeselektor"] });
    expect(applied.note).toBe("We filled in the form from your description. Check each entry; nothing is ranked yet.");
  });

  it("a partial room lists what was found and what is missing, without echoing any name", () => {
    const applied = applyProposal({ city: "", crowd: [], candidates: [] }, { city: "Leipzig", crowdActs: ["Khruangbin", "Bonobo"], candidateActs: [] });
    expect(applied.complete).toBe(false);
    expect(applied.note).toBe("We found a city but only 2 acts the crowd follows (3 needed) and no candidate acts. Add what is missing in the form; nothing is ranked yet.");
    expect(applied.note).not.toContain("Khruangbin");
  });

  it("keeps what the booker typed for a list the description left empty, and drops a candidate that is also a crowd act", () => {
    const applied = applyProposal(
      { city: "Berlin", crowd: ["A", "B", "C"], candidates: ["X"] },
      { city: "", crowdActs: [], candidateActs: ["a", "Y"] },
    );
    expect(applied.city).toBe("Berlin");
    expect(applied.crowd).toEqual(["A", "B", "C"]);
    expect(applied.candidates).toEqual(["Y"]);
  });

  it("caps the lists at the form limits", () => {
    const applied = applyProposal({ city: "", crowd: [], candidates: [] }, { city: "X", crowdActs: ["1", "2", "3", "4", "5", "6", "7", "8"], candidateActs: [] });
    expect(applied.crowd).toHaveLength(6);
  });

  it("joins the answer to the first description and flags text over 500 characters", () => {
    expect(withAnswer("We run a venue.", "It is in Reykjavik.")).toEqual({ text: "We run a venue. Answer: It is in Reykjavik.", tooLong: false });
    expect(withAnswer("a".repeat(400), "b".repeat(200)).tooLong).toBe(true);
  });

  it("reads only fixed fields of the reply and never server text", () => {
    expect(readIntakeReply(200, null, { status: "room", room: { city: "L", crowdActs: ["a"], candidateActs: [] } })).toMatchObject({ kind: "room" });
    expect(readIntakeReply(200, null, { status: "clarification", clarification: "Which city?" })).toEqual({ kind: "clarification", question: "Which city?" });
    expect(readIntakeReply(200, null, { status: "deterministic", reason: "no_recording" })).toEqual({ kind: "unreadable", demoUnrecorded: true });
    expect(readIntakeReply(200, null, { status: "intake_failed", reason: "step_limit" })).toEqual({ kind: "unreadable", demoUnrecorded: false });
    expect(readIntakeReply(429, "demo_limit_reached", null)).toEqual({ kind: "demo-limit" });
    expect(readIntakeReply(429, "rate_limited", null)).toEqual({ kind: "busy" });
    expect(readIntakeReply(400, "invalid_input", { error: { code: "invalid_input", message: "raw" } })).toEqual({ kind: "unreadable", demoUnrecorded: false });
  });
});

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function open(): HTMLTextAreaElement {
  fireEvent.click(screen.getByText("Describe it in one sentence"));
  return screen.getByLabelText("Describe your room") as HTMLTextAreaElement;
}

describe("one-sentence intake in the room form", () => {
  it("is a labelled field with the AI disclosure linked to it, and no longer says coming soon", () => {
    render(<RoomForm demoMode={false} />);
    const field = open();
    expect(screen.queryByText(/Coming soon/)).toBeNull();
    expect(field.getAttribute("maxlength")).toBe("400");
    const described = (field.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "");
    expect(described.join(" ")).toContain("sent to an AI model");
  });

  it("an empty description gives a field error and sends nothing", () => {
    const fetchMock = stubFetch(200, {});
    render(<RoomForm demoMode={false} />);
    const field = open();
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("intake-sentence-error")?.textContent).toBe("Write a sentence about your room first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reading: the button is aria-busy with 'Reading…', the region is aria-busy and a status says what is happening", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<RoomForm demoMode={false} />);
    fireEvent.change(open(), { target: { value: "Leipzig club" } });
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    const button = await screen.findByRole("button", { name: "Reading…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Reading your description").closest("[role=status]")).toBeTruthy();
    expect(screen.getByTestId("intake-assist").querySelector("[aria-busy=true]")).toBeTruthy();
    expect((screen.getByLabelText("Describe your room") as HTMLTextAreaElement).readOnly).toBe(true);
  });

  it("success fills the form fields and focuses the note", async () => {
    stubFetch(200, { status: "room", room: { city: "Leipzig", crowdActs: ["Moderat", "Apparat", "Modeselektor"], candidateActs: ["Khruangbin", "Radiohead", "Reality Club"] } });
    render(<RoomForm demoMode={false} />);
    fireEvent.change(open(), { target: { value: "Leipzig club" } });
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    const note = await screen.findByTestId("intake-note");
    expect(note.textContent).toBe("We filled in the form from your description. Check each entry; nothing is ranked yet.");
    await waitFor(() => expect(document.activeElement).toBe(note));
    expect((screen.getByLabelText("City (required)") as HTMLInputElement).value).toBe("Leipzig");
    expect(screen.getByText("3 of 6 added")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rank these acts" }).getAttribute("aria-disabled")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("asks the one clarifying question, then sends the answer once with clarified: true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "clarification", clarification: "Which city is the venue in?" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "room", room: { city: "Reykjavik", crowdActs: ["a", "b", "c"], candidateActs: ["d", "e", "f"] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RoomForm demoMode={false} />);
    fireEvent.change(open(), { target: { value: "We run a small venue." } });
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    expect(await screen.findByText("Which city is the venue in?")).toBeTruthy();
    const answer = screen.getByLabelText("Your answer");
    await waitFor(() => expect(document.activeElement).toBe(answer));
    fireEvent.change(answer, { target: { value: "Reykjavik" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    });
    await screen.findByTestId("intake-note");
    const second = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)) as { text: string; clarified: boolean };
    expect(second).toEqual({ text: "We run a small venue. Answer: Reykjavik", clarified: true });
  });

  it.each([
    ["an unreadable reply", 200, { status: "intake_failed", reason: "step_limit" }, /We could not read that description\. The form above works without it\./],
    ["the model being unavailable", 200, { status: "deterministic", reason: "llm_unavailable" }, /The form above works without it\./],
    ["a rejected body", 400, { error: { code: "invalid_input", message: "raw upstream text hackathon.api.qloo.com" } }, /The form above works without it\./],
    ["the daily limit", 429, { error: { code: "demo_limit_reached", message: "x" } }, /daily limit for reading descriptions/],
    ["a busy server", 429, { error: { code: "rate_limited", message: "x" } }, /busy right now/],
  ])("%s shows a fixed message, keeps the form usable and never shows server text", async (_label, status, body, pattern) => {
    stubFetch(status, body);
    render(<RoomForm demoMode={false} />);
    fireEvent.change(open(), { target: { value: "Leipzig club" } });
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    const heading = await screen.findByRole("heading", { name: "Could not read the description" });
    const state = heading.closest("section");
    expect(state?.textContent).toMatch(pattern);
    expect(state?.textContent).not.toContain("hackathon");
    expect(state?.textContent).not.toContain("raw");
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect((screen.getByLabelText("City (required)") as HTMLInputElement).readOnly).toBe(false);
  });

  it("a network failure shows the same fixed message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("boom hackathon.api.qloo.com"))));
    render(<RoomForm demoMode={false} />);
    fireEvent.change(open(), { target: { value: "Leipzig club" } });
    fireEvent.click(screen.getByRole("button", { name: "Read my description" }));
    const heading = await screen.findByRole("heading", { name: "Could not read the description" });
    expect(heading.closest("section")?.textContent).not.toContain("boom");
  });

  it("demo mode offers the recorded example sentence and says what the demo can read", () => {
    render(<RoomForm demoMode />);
    const field = open();
    fireEvent.click(screen.getByRole("button", { name: "Use the example sentence" }));
    expect(field.value).toBe(DEMO_EXAMPLE_SENTENCE);
    expect(screen.getByText(/can read one recorded example sentence/)).toBeTruthy();
  });
});
