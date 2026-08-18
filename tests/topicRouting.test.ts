import { describe, expect, it } from "vitest";
import { selectTopics } from "@/lib/business/topicRouting";

describe("selectTopics", () => {
  it("matches an industry from the finite list", () => {
    expect(selectTopics("Do you work with construction companies?")).toEqual(["industries"]);
  });

  it("matches an industry via an alias", () => {
    expect(selectTopics("We're a PE-backed portfolio company")).toEqual(["industries"]);
  });

  it("matches the AI Maturity Index via trigger terms", () => {
    expect(selectTopics("What is your eight-pillar maturity index?")).toEqual([
      "ai-maturity-index",
    ]);
  });

  it("matches security via trigger terms", () => {
    expect(selectTopics("How do you handle data security and encryption?")).toEqual([
      "security",
    ]);
  });

  it("falls back to the generic about-cadre + services default", () => {
    expect(selectTopics("What does Cadre AI do?")).toEqual(["about-cadre", "services"]);
  });

  it("resolves a bare follow-up using recent context", () => {
    expect(selectTopics("and construction?", ["Do you work with real estate firms?"])).toEqual([
      "industries",
    ]);
  });

  it("returns no match for an out-of-scope question", () => {
    expect(selectTopics("Can you help me file my taxes?")).toEqual([]);
  });
});
