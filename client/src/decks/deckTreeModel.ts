import type { AnkiDeckInfo } from "@shared/importTypes";

/** Anki's deck hierarchy, rebuilt from "Parent::Child" names. */
export interface DeckNode {
  /** Full "::" path; unique. */
  name: string;
  /** Last path segment. */
  label: string;
  /** Path segments, root first. */
  path: string[];
  /** Null when the parent deck isn't in the export (only its subdecks are). */
  deck: AnkiDeckInfo | null;
  children: DeckNode[];
  parent: DeckNode | null;
}

export function buildDeckTree(decks: AnkiDeckInfo[]): DeckNode[] {
  const byName = new Map<string, DeckNode>();
  const roots: DeckNode[] = [];
  const ensure = (path: string[]): DeckNode => {
    const name = path.join("::");
    let node = byName.get(name);
    if (node) return node;
    const parent = path.length > 1 ? ensure(path.slice(0, -1)) : null;
    node = { name, label: path[path.length - 1], path, deck: null, children: [], parent };
    byName.set(name, node);
    (parent ? parent.children : roots).push(node);
    return node;
  };
  for (const d of decks) ensure(d.name.split("::")).deck = d;
  // Natural sort so "Unit 2" comes before "Unit 10".
  const sort = (nodes: DeckNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function walk(nodes: DeckNode[], fn: (n: DeckNode) => void) {
  for (const n of nodes) {
    fn(n);
    walk(n.children, fn);
  }
}

/** Ids of the node and all its subdecks that have cards of their own (the ones worth sending to the server). */
export function selectableIds(node: DeckNode): string[] {
  const ids: string[] = [];
  walk([node], (n) => {
    if (n.deck && n.deck.noteCount > 0) ids.push(n.deck.id);
  });
  return ids;
}

export type CheckState = "checked" | "partial" | "unchecked";

export function checkState(node: DeckNode, selected: Set<string>): CheckState {
  const ids = selectableIds(node);
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? "unchecked" : n === ids.length ? "checked" : "partial";
}

/** Ticking a parent selects its whole subtree; unticking a fully selected one clears it. */
export function toggleNode(node: DeckNode, selected: Set<string>): Set<string> {
  const next = new Set(selected);
  const ids = selectableIds(node);
  if (checkState(node, selected) === "checked") ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}

/** Lowercase, full-width -> ASCII, and "Unit 02" -> "unit 2" so "unit 2" matches it. */
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/(^|\D)0+(\d)/g, "$1$2");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits a query into terms, keeping "section 2" together so it can't be satisfied by
 * "Section 1 › Unit 02". Numbers only match whole numbers (1 doesn't match 10).
 */
function queryTerms(query: string): RegExp[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  for (const w of words) {
    if (/^\d+$/.test(w) && terms.length && /\D$/.test(terms[terms.length - 1])) terms[terms.length - 1] += " " + w;
    else terms.push(w);
  }
  return terms.map((t) => new RegExp(escapeRe(t).replace(/(\d+)$/, "$1(?!\\d)").replace(/^(\d)/, "(?<!\\d)$1")));
}

/**
 * Names of nodes to show for a filter query: nodes whose full path contains every term of
 * the query, plus their ancestors (for context) and their subdecks. null = no filter.
 */
export function filterTree(roots: DeckNode[], query: string): Set<string> | null {
  const terms = queryTerms(query);
  if (!terms.length) return null;
  const visible = new Set<string>();
  walk(roots, (n) => {
    const hay = normalize(n.path.join(" "));
    if (!terms.every((t) => t.test(hay))) return;
    for (let p: DeckNode | null = n; p; p = p.parent) visible.add(p.name);
    walk(n.children, (c) => visible.add(c.name));
  });
  return visible;
}

/**
 * The selection expressed as the fewest subtrees: a fully selected section shows up once,
 * not as each of its units.
 */
export function selectionRoots(roots: DeckNode[], selected: Set<string>): DeckNode[] {
  const out: DeckNode[] = [];
  const visit = (n: DeckNode) => {
    const state = checkState(n, selected);
    if (state === "unchecked") return;
    if (state === "checked") {
      out.push(n);
      return;
    }
    // Partially selected: the parent's own cards may be picked even if not every child is.
    if (n.deck && selected.has(n.deck.id) && n.deck.noteCount > 0 && n.children.length) out.push({ ...n, children: [] });
    n.children.forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

/** Card total for a node and its subdecks (a childless copy from selectionRoots means "own cards only"). */
export function nodeCards(n: DeckNode): number {
  if (!n.children.length) return n.deck?.noteCount ?? 0;
  // A parent missing from the export has no total of its own; add up its subdecks.
  return n.deck ? n.deck.totalNoteCount : n.children.reduce((sum, c) => sum + nodeCards(c), 0);
}
