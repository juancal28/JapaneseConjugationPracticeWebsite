import { useEffect } from "react";
import { BackButton, DarkModeButton } from "../practice/components";
import verbData from "./verb-conjugation.json";
import adjData from "./adjective-conjugation.json";
import soundChanges from "./te-ta-sound-changes.json";
import "../styles/reference.css";

interface FormDef {
  key: string;
  label: string;
}

/** A column group: one example word with its rule column and plain/polite forms. */
interface Column {
  ruleHeading: string;
  wordHeading: string;
  rules: Record<string, string>;
  forms: Record<string, { plain: string; polite: string | string[] }>;
}

/**
 * Rules like "a + ない" mark the stem vowel; it's shown in bold (as in the source tables).
 * The dictionary-form row ("u") names the ending itself, so it stays plain.
 */
function Rule({ text, formKey }: { text: string; formKey: string }) {
  const m = /^([aeiou])(\b.*)$/.exec(text);
  if (!m || formKey === "dictionary") return <>{text}</>;
  return (
    <>
      <b>{m[1]}</b>
      {m[2]}
    </>
  );
}

function ConjugationTable({ forms, columns }: { forms: FormDef[]; columns: Column[] }) {
  return (
    <div className="conj-wrap">
      <table className="conj-table">
        <thead>
          <tr>
            <th rowSpan={2} scope="col">
              Form
            </th>
            {columns.map((c) => [
              <th key={c.ruleHeading} rowSpan={2} scope="col">
                {c.ruleHeading}
              </th>,
              <th key={c.wordHeading} colSpan={2} scope="colgroup">
                {c.wordHeading}
              </th>,
            ])}
          </tr>
          <tr>
            {columns.map((c) => [
              <th key={c.wordHeading + "plain"} scope="col">
                Plain
              </th>,
              <th key={c.wordHeading + "polite"} scope="col">
                Polite
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {forms.map((f) => (
            <tr key={f.key}>
              <th scope="row">{f.label}</th>
              {columns.map((c) => {
                const cell = c.forms[f.key];
                const polite = Array.isArray(cell.polite) ? cell.polite.join(" / ") : cell.polite;
                return [
                  <td key="rule" className="rule">
                    <Rule text={c.rules[f.key]} formKey={f.key} />
                  </td>,
                  <td key="plain">{cell.plain}</td>,
                  <td key="polite">{polite}</td>,
                ];
              })}
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
  );
}

const VERB_TYPE_LABELS: Record<string, string> = { godan: "Godan", ichidan: "Ichidan" };
const ADJ_TYPE_LABELS: Record<string, string> = { i: "い", na: "な" };

const verbColumns: Column[] = verbData.verbs.map((v) => ({
  ruleHeading: `${VERB_TYPE_LABELS[v.type]} rule`,
  wordHeading: `${v.verb} (${v.type})`,
  rules: verbData.rules[v.type as keyof typeof verbData.rules],
  forms: v.forms,
}));

const adjColumns: Column[] = adjData.adjectives.map((a) => ({
  ruleHeading: `${ADJ_TYPE_LABELS[a.type]} ending`,
  wordHeading: `${a.adjective} (${ADJ_TYPE_LABELS[a.type]}-adjective)`,
  rules: adjData.rules[a.type as keyof typeof adjData.rules],
  forms: a.forms,
}));

export default function ReferencePage() {
  useEffect(() => {
    document.title = "Reference";
  }, []);

  return (
    <div className="qm-body">
      <BackButton to="/" />
      <div className="qm-content reference">
        <h1 className="qm-heading">Reference</h1>
        <section>
          <h2>Verbs</h2>
          <ConjugationTable forms={verbData.forms} columns={verbColumns} />
          <h3>{soundChanges.title}</h3>
          <p className="reference-note">{soundChanges.description}</p>
          <SoundChangeTable />
        </section>
        <section>
          <h2>Adjectives</h2>
          <ConjugationTable forms={adjData.forms} columns={adjColumns} />
        </section>
      </div>
      <div className="qm-buttons">
        <DarkModeButton />
      </div>
    </div>
  );
}
