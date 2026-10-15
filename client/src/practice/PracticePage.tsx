import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isAdjType, isVerbType, type DeckSummary, type Word, type WordAnswers } from "@shared/types";
import { api, type DeckWithKey } from "../api";
import { Settings, Toggle, ToggleList } from "./components";
import Conjugation from "./Conjugation";

const DEFAULT_DECK = "builtin-verbs";
const SELECTED_KEY = "selectedDecks";

function loadSelection(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SELECTED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveSelection(slugs: string[]) {
  try {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(slugs));
  } catch {
    // Storage unavailable; selection just won't persist.
  }
}

export default function PracticePage() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [selected, setSelected] = useState<string[]>(loadSelection);
  const [loaded, setLoaded] = useState<Record<string, DeckWithKey>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listDecks().then(setDecks, (e) => setError(String(e)));
  }, []);

  // Drop selections for decks that no longer exist; nothing selected means the built-in verbs.
  const active = useMemo(() => {
    if (!decks) return [];
    const valid = selected.filter((s) => decks.some((d) => d.slug === s));
    return valid.length ? valid : decks.some((d) => d.slug === DEFAULT_DECK) ? [DEFAULT_DECK] : decks.slice(0, 1).map((d) => d.slug);
  }, [decks, selected]);

  useEffect(() => {
    for (const slug of active) {
      if (loaded[slug]) continue;
      api.getDeck(slug).then(
        (d) => setLoaded((prev) => ({ ...prev, [slug]: d })),
        (e) => setError(String(e)),
      );
    }
  }, [active, loaded]);

  const ready = active.length > 0 && active.every((s) => loaded[s]);
  const pool = useMemo(() => {
    if (!ready) return null;
    const words = new Map<string, Word>();
    const answers: Record<string, WordAnswers> = {};
    for (const slug of active) {
      const { deck, answerKey } = loaded[slug];
      for (const w of deck.words) {
        if (words.has(w.id) || !answerKey.words[w.id]) continue;
        words.set(w.id, w);
        answers[w.id] = answerKey.words[w.id];
      }
    }
    const list = [...words.values()];
    return { words: list, answers, hasVerbs: list.some((w) => isVerbType(w.type)), hasAdjs: list.some((w) => isAdjType(w.type)) };
  }, [ready, active, loaded]);

  const title = !pool || (pool.hasVerbs && !pool.hasAdjs)
    ? "Random Verb Conjugation Practice"
    : pool.hasAdjs && !pool.hasVerbs
      ? "Random Conjugation Adjective Practice"
      : "Random Conjugation Practice";

  useEffect(() => {
    document.title = title;
  }, [title]);

  const toggleDeck = (slug: string) => {
    const next = active.includes(slug) ? active.filter((s) => s !== slug) : [...active, slug];
    setSelected(next);
    saveSelection(next);
  };

  const deckPicker = decks && (
    <Settings legend="Decks" id="decks">
      <ToggleList>
        {decks.map((d) => (
          <Toggle key={d.slug} id={"deck-" + d.slug} label={d.name} checked={active.includes(d.slug)} onToggle={() => toggleDeck(d.slug)} />
        ))}
      </ToggleList>
      <Link className="manage-decks" to="/decks">
        Manage decks / upload an Anki deck
      </Link>
    </Settings>
  );

  if (error) return <p className="empty-pool">Couldn't load decks: {error}</p>;
  if (!pool) return null;
  if (pool.words.length === 0) {
    return (
      <div className="qm-body">
        <div className="qm-content">
          <h1 className="qm-heading">{title}</h1>
          <p className="empty-pool">The selected decks have no conjugatable words.</p>
          {deckPicker}
        </div>
      </div>
    );
  }

  return (
    <Conjugation key={active.join(",")} title={title} {...pool}>
      {deckPicker}
    </Conjugation>
  );
}
