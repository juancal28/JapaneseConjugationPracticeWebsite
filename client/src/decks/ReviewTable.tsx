import { useMemo, useState } from "react";
import { toHiragana } from "wanakana";
import { conjugateCell } from "@shared/conjugation/answerKey";
import { FORMS_BY_ID } from "@shared/conjugation/forms";
import { rubyHtml } from "@shared/ids";
import type { ReviewResult, ReviewRow, ReviewType } from "@shared/importTypes";
import { realign, rowIncluded, rowProblem, rowToWord } from "@shared/reviewRows";
import { WORD_EXCEPTIONS, isVerbType, type Word, type WordException } from "@shared/types";
import { ApiError } from "../api";

const TYPE_OPTIONS: { value: ReviewType; label: string }[] = [
  { value: "u", label: "う-verb (godan)" },
  { value: "ru", label: "る-verb (ichidan)" },
  { value: "irr", label: "Irregular (する/来る)" },
  { value: "i", label: "い-adjective" },
  { value: "na", label: "な-adjective" },
  { value: "skip", label: "Skip (not conjugatable)" },
];

const EXCEPTION_LABELS: Record<Exclude<WordException, null>, string> = {
  iku: "行く (いって)",
  aru: "ある (ない)",
  honorific: "くださる-type",
  kureru: "くれる",
  ii: "いい (よく)",
};

type Filter = "all" | "included" | "attention" | "skipped";

/** Step 3 (or editing a saved deck): check every word, fix mistakes, then save. */
export default function ReviewTable(props: {
  initialName: string;
  initialRows: ReviewRow[];
  status?: ReviewResult;
  onCancel: () => void;
  onSave: (name: string, words: Word[]) => Promise<void>;
}) {
  const [name, setName] = useState(props.initialName);
  const [rows, setRows] = useState(props.initialRows);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>(() => (props.initialRows.some((r) => r.flags.length) ? "attention" : "all"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; details: string[] } | null>(null);

  const problems = useMemo(() => new Map(rows.map((r) => [r.rowId, rowProblem(r)])), [rows]);
  const included = rows.filter(rowIncluded);
  const invalid = included.filter((r) => problems.get(r.rowId));
  const needsAttention = (r: ReviewRow) => r.flags.length > 0 || !!problems.get(r.rowId);

  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "included" ? rowIncluded(r) : filter === "skipped" ? !rowIncluded(r) : needsAttention(r),
  );

  const update = (rowId: string, patch: Partial<ReviewRow>, align = false) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? (align ? realign({ ...r, ...patch }) : { ...r, ...patch }) : r)));
    setEdited((prev) => new Set(prev).add(rowId));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const words = included.map((r) => rowToWord(r, edited.has(r.rowId)));
      const ids = new Set<string>();
      const dupes = words.filter((w) => (ids.has(w.id) ? true : (ids.add(w.id), false)));
      if (dupes.length) throw new ApiError("Some words appear twice; untick the extra copies.", dupes.map((w) => w.kana));
      await props.onSave(name.trim(), words);
    } catch (e) {
      setError(e instanceof ApiError ? { text: e.message, details: e.details } : { text: String(e), details: [] });
      setSaving(false);
    }
  };

  const s = props.status;
  return (
    <>
      {s?.jmdictStatus === "missing" && (
        <div className="dm-banner warn">
          The JMdict dictionary isn't installed, so words were classified without it. Run <code>npm run setup:jmdict</code> and re-import for better results.
        </div>
      )}
      {s?.claudeStatus === "skipped-no-key" && (
        <div className="dm-banner warn">
          Claude review was skipped because <code>ANTHROPIC_API_KEY</code> isn't set in <code>.env</code>. These are JMdict-only results, so check them carefully.
        </div>
      )}
      {s?.claudeStatus === "failed" && <div className="dm-banner error">Claude review failed: {s.claudeError}. Showing JMdict-only results.</div>}
      {s?.claudeStatus === "ok" && <div className="dm-banner ok">Classified with JMdict and reviewed by Claude. Highlighted rows need a look.</div>}

      <section>
        <label>
          <strong>Deck name</strong>
          <br />
          <input className="deck-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </section>

      <div className="dm-filter">
        {(
          [
            ["attention", `Needs attention (${rows.filter(needsAttention).length})`],
            ["included", `To practice (${included.length})`],
            ["skipped", `Skipped (${rows.length - included.length})`],
            ["all", `All (${rows.length})`],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <label key={f}>
            <input type="radio" name="filter" checked={filter === f} onChange={() => setFilter(f)} /> {label}
          </label>
        ))}
      </div>

      <table className="dm-table review">
        <thead>
          <tr>
            <th>Use</th>
            <th style={{ width: "18%" }}>Word / reading</th>
            <th style={{ width: "18%" }}>English</th>
            <th style={{ width: "17%" }}>Type</th>
            <th>Preview</th>
            <th style={{ width: "24%" }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const problem = problems.get(r.rowId);
            const cls = !rowIncluded(r) ? "excluded" : problem ? "invalid" : r.flags.length ? "attention" : "";
            return (
              <tr key={r.rowId} className={cls}>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Practice this word"
                    checked={r.include}
                    disabled={r.type === "skip"}
                    onChange={(e) => update(r.rowId, { include: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="jp"
                    type="text"
                    value={r.kanjiSurface}
                    aria-label="Written form"
                    onChange={(e) => update(r.rowId, { kanjiSurface: e.target.value.trim() }, true)}
                  />
                  <input
                    className="jp"
                    type="text"
                    value={r.kana}
                    aria-label="Reading"
                    style={{ marginTop: 4 }}
                    onChange={(e) => update(r.rowId, { kana: e.target.value.trim() }, true)}
                    onBlur={(e) => /[a-z]/i.test(e.target.value) && update(r.rowId, { kana: toHiragana(e.target.value) }, true)}
                  />
                </td>
                <td>
                  <input type="text" value={r.eng} aria-label="English" onChange={(e) => update(r.rowId, { eng: e.target.value })} />
                </td>
                <td>
                  <select
                    value={r.type}
                    aria-label="Word type"
                    onChange={(e) => {
                      const type = e.target.value as ReviewType;
                      update(r.rowId, { type, include: type !== "skip", exception: null });
                    }}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {r.type !== "skip" && (
                    <select
                      value={r.exception ?? ""}
                      aria-label="Exception"
                      style={{ marginTop: 4 }}
                      onChange={(e) => update(r.rowId, { exception: (e.target.value || null) as WordException })}
                    >
                      <option value="">No exception</option>
                      {WORD_EXCEPTIONS.map((x) => (
                        <option key={x} value={x}>
                          {EXCEPTION_LABELS[x]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  <Preview row={r} problem={problem ?? null} />
                </td>
                <td>
                  {r.jmdict.candidates[0] ? (
                    <div className="dm-muted">JMdict: {r.jmdict.candidates[0].pos.join(", ")}</div>
                  ) : (
                    props.status?.jmdictStatus === "ok" && <div className="dm-muted">JMdict: no verb/adjective entry</div>
                  )}
                  {r.claude?.note && <div className="dm-note">Claude: {r.claude.note}</div>}
                  {(r.flags.length > 0 || problem) && (
                    <ul className="dm-flags">
                      {problem && <li>⚠ {problem}</li>}
                      {r.flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {visible.length === 0 && <p className="dm-muted">Nothing in this view.</p>}

      <div className="dm-sticky">
        {error && (
          <div className="dm-banner error">
            {error.text}
            {error.details.length > 0 && (
              <ul>
                {error.details.slice(0, 10).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="dm-actions">
          <button className="dm-btn primary" disabled={saving || included.length === 0 || invalid.length > 0 || !name.trim()} onClick={save}>
            {saving ? "Saving…" : `Save deck (${included.length} words)`}
          </button>
          <button className="dm-btn" onClick={props.onCancel} disabled={saving}>
            Cancel
          </button>
          {invalid.length > 0 && <span className="dm-muted">Fix or untick {invalid.length} invalid word(s) to save.</span>}
        </div>
      </div>
    </>
  );
}

const PREVIEW_FORMS = { verb: ["negative", "past", "te"], adj: ["adj-negative", "adj-past"] };

function Preview({ row, problem }: { row: ReviewRow; problem: string | null }) {
  if (!rowIncluded(row) || problem || row.type === "skip") return <span className="dm-muted">—</span>;
  const word: Word = { id: "", kana: row.kana, kanji: row.kanji, eng: row.eng, type: row.type, exception: row.exception };
  const forms = isVerbType(row.type) ? PREVIEW_FORMS.verb : PREVIEW_FORMS.adj;
  return (
    <div className="dm-preview">
      {forms.map((id) => {
        let html = "?";
        try {
          html = conjugateCell(word, FORMS_BY_ID[id], {})?.kanji[0] ?? "—";
        } catch {
          // Shown as "?"; the row is also flagged by validation.
        }
        return (
          <div key={id}>
            <span dangerouslySetInnerHTML={{ __html: rubyHtml(html) }} />
          </div>
        );
      })}
    </div>
  );
}
