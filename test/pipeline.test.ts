import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyImport } from "../server/classify/pipeline";
import { loadJmdict } from "../server/classify/jmdict";
import type { ParsedCollection } from "../server/anki/parseApkg";

const col: ParsedCollection = {
  decks: [
    { id: "1", name: "Genki::Lesson 3" },
    { id: "2", name: "Genki::Lesson 4" },
  ],
  noteTypes: [{ id: "77", name: "Japanese", fields: ["Expression", "Meaning"] }],
  notes: [
    { id: "a", noteTypeId: "77", fields: [" 食[た]べる", "to eat"], deckIds: ["1"] },
    { id: "b", noteTypeId: "77", fields: [" 勉強[べんきょう]する", "to study"], deckIds: ["1"] },
    { id: "c", noteTypeId: "77", fields: [" 本[ほん]", "book"], deckIds: ["1"] },
    { id: "d", noteTypeId: "77", fields: ["きれい", "pretty"], deckIds: ["1"] },
    { id: "e", noteTypeId: "77", fields: [" 食[た]べる", "to eat (dup)"], deckIds: ["1"] },
    { id: "f", noteTypeId: "77", fields: [" 行[い]く", "to go"], deckIds: ["2"] },
  ],
};

describe.skipIf(!loadJmdict())("classifyImport without Claude", () => {
  beforeEach(() => {
    // Never call the real API from tests.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
  });

  it("classifies cards from the selected decks with JMdict", async () => {
    const result = await classifyImport(col, "Genki.apkg", {
      importId: "x",
      deckIds: ["1"],
      mappings: { "77": { expression: 0, reading: null, meaning: 1 } },
    });
    expect(result.claudeStatus).toBe("skipped-no-key");
    expect(result.suggestedName).toBe("Lesson 3");
    const byId = Object.fromEntries(result.rows.map((r) => [r.rowId, r]));
    expect(Object.keys(byId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(byId.a).toMatchObject({ type: "ru", include: true, kana: "たべる", kanji: "食<rt>た</rt>べる" });
    expect(byId.b).toMatchObject({ type: "irr", include: true, kanji: "勉強<rt>べんきょう</rt>する" });
    expect(byId.c).toMatchObject({ type: "skip", include: false });
    expect(byId.d).toMatchObject({ type: "na", include: true, kanji: "きれい" });
    expect(byId.e.include).toBe(false);
    expect(byId.e.flags).toContain("Duplicate of an earlier card");
  });
});
