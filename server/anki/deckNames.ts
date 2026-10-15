import type { ParsedCollection } from "./parseApkg";

const segments = (name: string) => name.split("::");
const isUnder = (name: string, ancestor: string) => name === ancestor || name.startsWith(ancestor + "::");

function commonPrefix(names: string[]): string {
  if (!names.length) return "";
  const parts = names.map(segments);
  const out: string[] = [];
  for (let i = 0; parts.every((p) => p[i] !== undefined && p[i] === parts[0][i]); i++) out.push(parts[0][i]);
  return out.join("::");
}

/**
 * Default name for a deck built from the selected Anki decks. Units are often named alike
 * across sections ("Section 1::Unit 01", "Section 2::Unit 01"), so a single unit keeps its
 * parent's name: "Section 3 · Unit 01". A whole section is just "Section 3".
 */
export function suggestDeckName(col: ParsedCollection, selectedIds: string[], fileName: string): { name: string; ankiDeck: string } {
  const selected = new Set(selectedIds);
  const withCards = new Set(col.notes.flatMap((n) => n.deckIds));
  const fallback = fileName.replace(/\.(apkg|colpkg)$/i, "");

  // A deck is covered when every deck with cards in its subtree is selected.
  const covered = (name: string) => {
    const subtree = col.decks.filter((d) => isUnder(d.name, name) && withCards.has(d.id));
    return subtree.length > 0 && subtree.every((d) => selected.has(d.id));
  };
  const coveredNames = new Set(col.decks.map((d) => d.name).filter(covered));
  const parentName = (name: string) => segments(name).slice(0, -1).join("::");
  const roots = [...coveredNames].filter((n) => !coveredNames.has(parentName(n))).sort();

  if (roots.length === 0) return { name: fallback, ankiDeck: fallback };
  if (roots.length === 1) {
    const root = roots[0];
    const parts = segments(root);
    const hasSubdecks = col.decks.some((d) => d.name !== root && isUnder(d.name, root) && withCards.has(d.id));
    const name = hasSubdecks || parts.length === 1 ? parts[parts.length - 1] : `${parts[parts.length - 2]} · ${parts[parts.length - 1]}`;
    return { name, ankiDeck: root };
  }
  const common = commonPrefix(roots);
  if (!common) return { name: fallback, ankiDeck: fallback };
  return { name: `${segments(common).pop()} · ${roots.length} decks`, ankiDeck: common };
}
