import { describe, expect, it } from "vitest";
import {
  buildDeckTree,
  checkState,
  filterTree,
  nodeCards,
  selectionRoots,
  toggleNode,
  type DeckNode,
} from "../client/src/decks/deckTreeModel";
import { suggestDeckName } from "../server/anki/deckNames";
import type { AnkiDeckInfo } from "../shared/importTypes";
import type { ParsedCollection } from "../server/anki/parseApkg";

const D = "Duolingo Japanese Lessons Vocab";
// id, name, own cards
const DECKS: [string, string, number][] = [
  ["1", D, 0],
  ["10", `${D}::Section 1`, 0],
  ["11", `${D}::Section 1::Unit 01 - Greetings`, 10],
  ["12", `${D}::Section 1::Unit 02 - Food`, 8],
  ["13", `${D}::Section 1::Unit 10 - Travel`, 5],
  ["20", `${D}::Section 2`, 0],
  ["21", `${D}::Section 2::Unit 01 - Weather`, 7],
  ["22", `${D}::Section 2::Unit 02 - Shopping`, 6],
  ["30", "Core 2k", 40],
];

const infos: AnkiDeckInfo[] = DECKS.map(([id, name, noteCount]) => ({
  id,
  name,
  noteCount,
  totalNoteCount: DECKS.filter(([, n]) => n === name || n.startsWith(name + "::")).reduce((s, [, , c]) => s + c, 0),
}));

const find = (roots: DeckNode[], label: string): DeckNode => {
  const stack = [...roots];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.label === label) return n;
    stack.push(...n.children);
  }
  throw new Error(label);
};

describe("deck tree", () => {
  const roots = buildDeckTree(infos);

  it("nests subdecks and sorts units naturally", () => {
    expect(roots.map((r) => r.label)).toEqual(["Core 2k", D]);
    const s1 = find(roots, "Section 1");
    expect(s1.children.map((c) => c.label)).toEqual(["Unit 01 - Greetings", "Unit 02 - Food", "Unit 10 - Travel"]);
    expect(nodeCards(s1)).toBe(23);
    expect(nodeCards(find(roots, D))).toBe(36);
  });

  it("ticking a section selects all its units; unticking clears them", () => {
    const s1 = find(roots, "Section 1");
    const sel = toggleNode(s1, new Set());
    expect([...sel].sort()).toEqual(["11", "12", "13"]);
    expect(checkState(s1, sel)).toBe("checked");
    expect(checkState(find(roots, D), sel)).toBe("partial");
    expect(toggleNode(s1, sel).size).toBe(0);
  });

  it("a partly selected section becomes fully selected when ticked", () => {
    const s1 = find(roots, "Section 1");
    const sel = toggleNode(s1, new Set(["11"]));
    expect(sel.size).toBe(3);
  });

  it("summarizes the selection as whole sections plus single units", () => {
    const sel = new Set(["11", "12", "13", "22"]);
    const chosen = selectionRoots(roots, sel);
    expect(chosen.map((n) => n.path.slice(1).join(" › "))).toEqual(["Section 1", "Section 2 › Unit 02 - Shopping"]);
  });

  it("filters by every word of the query, ignoring leading zeros", () => {
    const visible = filterTree(roots, "section 2 unit 1")!;
    expect(visible.has(`${D}::Section 2::Unit 01 - Weather`)).toBe(true);
    expect(visible.has(`${D}::Section 2`)).toBe(true); // ancestors stay visible for context
    expect(visible.has(`${D}::Section 1::Unit 01 - Greetings`)).toBe(false);
    expect(visible.has(`${D}::Section 1::Unit 10 - Travel`)).toBe(false);
    // "section 2 unit 1" must not match Section 1 › Unit 02 just because both numbers appear.
    expect(visible.has(`${D}::Section 1::Unit 02 - Food`)).toBe(false);
    // Whole numbers only: "unit 1" isn't "Unit 10".
    expect(filterTree(roots, "unit 1")!.has(`${D}::Section 1::Unit 10 - Travel`)).toBe(false);
    expect(filterTree(roots, "travel")!.has(`${D}::Section 1::Unit 10 - Travel`)).toBe(true);
    expect(filterTree(roots, "  ")).toBeNull();
  });
});

describe("suggestDeckName", () => {
  const col: ParsedCollection = {
    decks: DECKS.map(([id, name]) => ({ id, name })),
    noteTypes: [],
    notes: DECKS.flatMap(([id, , count]) => Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, noteTypeId: "x", fields: [], deckIds: [id] }))),
  };

  it("names a single unit after its section", () => {
    expect(suggestDeckName(col, ["21"], "duo.apkg")).toEqual({ name: "Section 2 · Unit 01 - Weather", ankiDeck: `${D}::Section 2::Unit 01 - Weather` });
  });

  it("names a whole section after the section", () => {
    expect(suggestDeckName(col, ["11", "12", "13"], "duo.apkg")).toEqual({ name: "Section 1", ankiDeck: `${D}::Section 1` });
  });

  it("names several units by their shared parent", () => {
    expect(suggestDeckName(col, ["11", "12"], "duo.apkg")).toEqual({ name: "Section 1 · 2 decks", ankiDeck: `${D}::Section 1` });
  });

  it("falls back to the file name when nothing is shared", () => {
    expect(suggestDeckName(col, ["11", "30"], "My Decks.apkg").name).toBe("My Decks");
    expect(suggestDeckName(col, ["30"], "x.apkg").name).toBe("Core 2k");
  });
});
