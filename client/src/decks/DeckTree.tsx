import { useMemo, useState } from "react";
import type { AnkiDeckInfo } from "@shared/importTypes";
import {
  buildDeckTree,
  checkState,
  filterTree,
  nodeCards,
  selectableIds,
  selectionRoots,
  toggleNode,
  walk,
  type DeckNode,
} from "./deckTreeModel";

/** Anki-style collapsible deck picker with tri-state checkboxes, a filter and a "Selected" summary. */
export default function DeckTree(props: { decks: AnkiDeckInfo[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const roots = useMemo(() => buildDeckTree(props.decks), [props.decks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterTree(roots, query), [roots, query]);
  const chosen = selectionRoots(roots, props.selected);
  // When every pick is under the same top-level deck, its (often long) name adds nothing.
  const skip = chosen.length > 0 && chosen.every((n) => n.path.length > 1 && n.path[0] === chosen[0].path[0]) ? 1 : 0;

  const toggleCollapse = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const setAllCollapsed = (collapse: boolean) => {
    const next = new Set<string>();
    if (collapse) walk(roots, (n) => n.children.length && next.add(n.name));
    setCollapsed(next);
  };

  return (
    <div className="deck-picker">
      <div className="deck-picker-tree">
        <div className="deck-picker-tools">
          <input
            type="search"
            placeholder='Filter, e.g. "section 3 unit 2"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter decks"
          />
          <button type="button" className="dm-btn" onClick={() => setAllCollapsed(false)}>
            Expand all
          </button>
          <button type="button" className="dm-btn" onClick={() => setAllCollapsed(true)}>
            Collapse all
          </button>
        </div>
        <ul className="deck-tree" role="tree">
          {roots.map((n) => (
            <TreeRow
              key={n.name}
              node={n}
              selected={props.selected}
              onToggle={(node) => props.onChange(toggleNode(node, props.selected))}
              collapsed={collapsed}
              onCollapse={toggleCollapse}
              visible={visible}
            />
          ))}
        </ul>
        {visible && visible.size === 0 && <p className="dm-muted">No decks match "{query}".</p>}
      </div>

      <div className="deck-picker-selected">
        <strong>Selected</strong>
        {chosen.length === 0 ? (
          <p className="dm-muted">Nothing yet. Tick a section to take all its units, or pick single units.</p>
        ) : (
          <ul>
            {chosen.map((n) => (
              <li key={n.name + (n.children.length ? "" : ":own")}>
                <span className="deck-path">
                  {n.path.slice(skip, -1).map((p, i) => (
                    <span key={i} className="dm-muted">
                      {p} ›{" "}
                    </span>
                  ))}
                  {n.label}
                </span>{" "}
                <span className="dm-muted">({nodeCards(n)} cards)</span>
                <button
                  type="button"
                  className="deck-remove"
                  aria-label={`Remove ${n.path.join(" › ")}`}
                  onClick={() => {
                    const next = new Set(props.selected);
                    (n.children.length ? selectableIds(n) : n.deck ? [n.deck.id] : []).forEach((id) => next.delete(id));
                    props.onChange(next);
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TreeRow(props: {
  node: DeckNode;
  selected: Set<string>;
  onToggle: (n: DeckNode) => void;
  collapsed: Set<string>;
  onCollapse: (name: string) => void;
  visible: Set<string> | null;
}) {
  const { node, visible } = props;
  const state = checkState(node, props.selected);

  if (visible && !visible.has(node.name)) return null;
  const hasChildren = node.children.length > 0;
  // While filtering, show matches inside collapsed decks too.
  const open = hasChildren && (visible !== null || !props.collapsed.has(node.name));
  const cards = nodeCards(node);
  const empty = selectableIds(node).length === 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined}>
      <div className={"deck-row" + (state !== "unchecked" ? " is-selected" : "")}>
        {hasChildren ? (
          <button
            type="button"
            className="deck-twisty"
            aria-label={open ? `Collapse ${node.label}` : `Expand ${node.label}`}
            onClick={() => props.onCollapse(node.name)}
            disabled={visible !== null}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="deck-twisty" />
        )}
        <label>
          <input
            // indeterminate has no HTML attribute; set it on every render so remounted boxes keep it.
            ref={(el) => {
              if (el) el.indeterminate = state === "partial";
            }}
            type="checkbox" checked={state === "checked"} disabled={empty} onChange={() => props.onToggle(node)} />{" "}
          <span className={hasChildren ? "deck-parent" : ""}>{node.label}</span>{" "}
          <span className="dm-muted">
            {cards} cards
            {hasChildren && ` · ${node.children.length} subdeck${node.children.length === 1 ? "" : "s"}`}
          </span>
        </label>
      </div>
      {open && (
        <ul role="group">
          {node.children.map((c) => (
            <TreeRow key={c.name} {...props} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}
