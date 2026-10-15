import { describe, expect, it, vi } from "vitest";
import type { ParsedCollection } from "../server/anki/parseApkg";
import { loadJmdict } from "../server/classify/jmdict";

// Replace the API call with canned Claude output; the merge logic is what's under test.
vi.mock("../server/classify/claudeReview", () => ({
  ClaudeUnavailableError: class extends Error {},
  reviewWithClaude: vi.fn(async () =>
    new Map([
      ["a", { id: "a", include: true, kana: "たべる", kanjiSurface: "食べる", eng: "to eat", type: "ru", exception: "none", confidence: "high", note: "Card showed the polite form 食べます." }],
      ["b", { id: "b", include: false, kana: "ほん", kanjiSurface: "本", eng: "book", type: "skip", exception: "none", confidence: "high", note: "Noun." }],
      ["c", { id: "c", include: true, kana: "ゆうめい", kanjiSurface: "有名", eng: "famous", type: "na", exception: "none", confidence: "low", note: "" }],
    ]),
  ),
}));

const { classifyImport } = await import("../server/classify/pipeline");

const col: ParsedCollection = {
  decks: [{ id: "1", name: "Duolingo::Unit 5" }],
  noteTypes: [{ id: "9", name: "Basic", fields: ["Front", "Back"] }],
  notes: [
    { id: "a", noteTypeId: "9", fields: ["食べます", "eat (polite)"], deckIds: ["1"] },
    { id: "b", noteTypeId: "9", fields: ["本", "book"], deckIds: ["1"] },
    { id: "c", noteTypeId: "9", fields: ["有名な", "famous"], deckIds: ["1"] },
  ],
};

describe.skipIf(!loadJmdict())("classifyImport with Claude review", () => {
  it("applies Claude's corrections and flags disagreements", async () => {
    const result = await classifyImport(col, "duo.apkg", {
      importId: "x",
      deckIds: ["1"],
      mappings: { "9": { expression: 0, reading: null, meaning: 1 } },
    });
    expect(result.claudeStatus).toBe("ok");
    const [a, b, c] = result.rows;
    // JMdict can't find 食べます; Claude converts it to dictionary form.
    expect(a).toMatchObject({ type: "ru", include: true, kana: "たべる", kanji: "食<rt>た</rt>べる", eng: "to eat" });
    expect(a.claude?.note).toMatch(/polite/);
    expect(b).toMatchObject({ type: "skip", include: false });
    // 有名な is normalized to 有名 by the JMdict step; Claude agrees but is unsure.
    expect(c).toMatchObject({ type: "na", kana: "ゆうめい", kanji: "有名<rt>ゆうめい</rt>" });
    expect(c.jmdict.suggestedType).toBe("na");
    expect(c.flags).toContain("Claude is unsure");
  });
});
