import { useMemo, useState } from "react";
import type { FieldMapping, ImportPreview, ReviewResult } from "@shared/importTypes";
import { api } from "../api";
import DeckTree from "./DeckTree";
import { buildDeckTree, nodeCards, selectionRoots } from "./deckTreeModel";

/** Step 2: pick which Anki (sub)decks to import and which fields hold the word, reading and meaning. */
export default function ImportSetup(props: { preview: ImportPreview; onCancel: () => void; onClassified: (r: ReviewResult) => void }) {
  const { preview } = props;
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Preselect the only deck with cards, if there's just one.
    const withCards = preview.decks.filter((d) => d.noteCount > 0);
    return new Set(withCards.length === 1 ? [withCards[0].id] : []);
  });
  const deckIds = [...selected];
  const roots = useMemo(() => buildDeckTree(preview.decks), [preview.decks]);
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>(() =>
    Object.fromEntries(preview.noteTypes.map((nt) => [nt.id, nt.mapping])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNotes = selectionRoots(roots, selected).reduce((n, node) => n + nodeCards(node), 0);
  const setField = (ntId: string, key: keyof FieldMapping, value: string) =>
    setMappings((prev) => ({ ...prev, [ntId]: { ...prev[ntId], [key]: value === "" ? null : Number(value) } }));

  const classify = async () => {
    setBusy(true);
    setError(null);
    try {
      props.onClassified(await api.classify({ importId: preview.importId, deckIds, mappings }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Import "{preview.fileName}"</h2>

      <section>
        <h3>1. Which decks?</h3>
        <p className="dm-muted">Pick the chapter or unit you want to practice. Ticking a section takes all of its subdecks.</p>
        <DeckTree decks={preview.decks} selected={selected} onChange={setSelected} />
      </section>

      <section>
        <h3>2. Which fields?</h3>
        <p className="dm-muted">Fields were guessed from their contents. "Reading" can be left empty if the word field uses Anki furigana (漢字[かんじ]).</p>
        {preview.noteTypes.map((nt) => (
          <div key={nt.id} style={{ marginBottom: 20 }}>
            <strong>{nt.name}</strong> <span className="dm-muted">({nt.noteCount} notes)</span>
            <table className="dm-table" style={{ marginTop: 6 }}>
              <tbody>
                {(["expression", "reading", "meaning"] as const).map((key) => (
                  <tr key={key}>
                    <td style={{ width: 160 }}>{key === "expression" ? "Japanese word" : key === "reading" ? "Reading (kana)" : "English meaning"}</td>
                    <td style={{ width: 220 }}>
                      <select value={mappings[nt.id][key] ?? ""} onChange={(e) => setField(nt.id, key, e.target.value)}>
                        <option value="">(none)</option>
                        {nt.fields.map((f, i) => (
                          <option key={i} value={i}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="dm-muted">
                      {mappings[nt.id][key] != null &&
                        nt.samples
                          .map((s) => s[mappings[nt.id][key]!])
                          .filter(Boolean)
                          .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {error && <div className="dm-banner error">{error}</div>}
      <div className="dm-actions">
        <button className="dm-btn primary" disabled={busy || deckIds.length === 0} onClick={classify}>
          {busy ? (
            <>
              <span className="dm-spinner" />
              Classifying {selectedNotes} cards (JMdict + Claude)…
            </>
          ) : (
            `Classify ${selectedNotes} cards`
          )}
        </button>
        <button className="dm-btn" onClick={props.onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </>
  );
}
