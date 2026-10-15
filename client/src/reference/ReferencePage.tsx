import { useEffect } from "react";
import { conjugateCell } from "@shared/conjugation/answerKey";
import { FORMS_BY_ID } from "@shared/conjugation/forms";
import { stripRuby } from "@shared/ids";
import { BackButton, DarkModeButton } from "../practice/components";
import { ADJ_ROWS, COLS, EXCEPTIONS, SECTIONS, VERB_ROWS, presentForms, type Col, type RowDef, type Section } from "./referenceData";
import { exceptionDiffs } from "./referenceModel";
import soundChanges from "./te-ta-sound-changes.json";
import "../styles/reference.css";

/** Each accepted answer of a cell, per example word (null = the combination doesn't exist). */
function cellAnswers(section: Section, row: RowDef, col: Col): string[][] | null {
  const opts = row.cells[col];
  if (!opts) return null;
  if (!row.form) return section.words.map((w) => (presentForms(w)[col] ?? []).map(stripRuby));
  const perWord = section.words.map((w) => conjugateCell(w, FORMS_BY_ID[row.form!], opts)?.kanji.map(stripRuby) ?? []);
  return perWord.every((a) => a.length === 0) ? [] : perWord;
}

function Cell({ section, row, col }: { section: Section; row: RowDef; col: Col }) {
  const answers = cellAnswers(section, row, col);
  if (answers === null) return <td className="na">—</td>;
  if (answers.length === 0)
    return (
      <td className="na">
        — <div className="rule">no such form</div>
      </td>
    );
  const rules = section.rules[row.id]?.[col] ?? [];
  return (
    <td>
      {rules.map((rule, i) => (
        <div key={i} className="variant">
          <div className="rule">{rule}</div>
          <div className="example">{answers.map((a) => a[i]).join(" · ")}</div>
        </div>
      ))}
    </td>
  );
}

function SectionTable({ section }: { section: Section }) {
  const rows = section.category === "verb" ? VERB_ROWS : ADJ_ROWS;
  return (
    <div className="conj-wrap">
      <table className="conj-table ref-table">
        <thead>
          <tr>
            <th scope="col">Form</th>
            {COLS.map((c) => (
              <th key={c.id} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                {row.label}
                <div className="quiz-name">{row.quiz}</div>
              </th>
              {COLS.map((c) => (
                <Cell key={c.id} section={section} row={row} col={c.id} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Which godan endings take which て/た change, with examples. */
function SoundChangeTable() {
  return (
    <>
      <h3>{soundChanges.title}</h3>
      <p className="reference-note">{soundChanges.description}</p>
      <div className="conj-wrap">
        <table className="conj-table sound-changes">
          <thead>
            <tr>
              <th scope="col">Ending</th>
              <th scope="col">Te / Ta</th>
              <th scope="col">Examples</th>
            </tr>
          </thead>
          <tbody>
            {soundChanges.rows.map((r) => (
              <tr key={r.ending}>
                <th scope="row">{r.ending}</th>
                <td>{r.change}</td>
                <td>{r.examples.map(([from, to]) => `${from} → ${to}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ExceptionsTable() {
  return (
    <div className="conj-wrap">
      <table className="conj-table exceptions">
        <thead>
          <tr>
            <th scope="col">Word</th>
            <th scope="col">What's different</th>
            <th scope="col">Answers that change</th>
          </tr>
        </thead>
        <tbody>
          {EXCEPTIONS.map((ex) => (
            <tr key={ex.word.kana}>
              <th scope="row">{stripRuby(ex.word.kanji)}</th>
              <td className="ex-note">{ex.note}</td>
              <td>
                <ul className="ex-list">
                  {exceptionDiffs(ex.word).map((d, i) => (
                    <li key={i}>
                      <span className="rule">{[d.option, d.form].filter(Boolean).join(" ")}:</span> {d.answers.join(" / ")}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReferencePage() {
  useEffect(() => {
    document.title = "Reference";
  }, []);

  return (
    <div className="qm-body">
      <BackButton to="/" />
      <div className="qm-content reference">
        <h1 className="qm-heading">Reference</h1>
        <p className="reference-note">
          Every answer the quiz accepts, with the rule that builds it. Rows are the quiz's forms; columns are its Negative and Polite options. Where a
          cell lists several answers, any of them is marked correct.
        </p>
        {SECTIONS.map((s) => (
          <section key={s.id}>
            <h2>{s.title}</h2>
            <p className="reference-note">{s.subtitle}</p>
            <SectionTable section={s} />
            {s.id === "godan" && <SoundChangeTable />}
          </section>
        ))}
        <section>
          <h2>Exceptions</h2>
          <p className="reference-note">These words break their type's rules. Every answer that differs from the rules above is listed.</p>
          <ExceptionsTable />
        </section>
      </div>
      <div className="qm-buttons">
        <DarkModeButton />
      </div>
    </div>
  );
}
