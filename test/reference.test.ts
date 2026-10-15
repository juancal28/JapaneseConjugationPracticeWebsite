import { describe, expect, it } from "vitest";
import { ADJ_FORMS, FORMS_BY_ID, VERB_FORMS, allCombos, comboKey } from "../shared/conjugation/forms";
import { conjugateCell } from "../shared/conjugation/answerKey";
import { ADJ_ROWS, COLS, EXCEPTIONS, SECTIONS, VERB_ROWS, type RowDef } from "../client/src/reference/referenceData";
import { exceptionDiffs } from "../client/src/reference/referenceModel";

describe("reference page covers every quiz form", () => {
  const cases: [string, typeof VERB_FORMS, RowDef[]][] = [
    ["verbs", VERB_FORMS, VERB_ROWS],
    ["adjectives", ADJ_FORMS, ADJ_ROWS],
  ];
  for (const [name, forms, rows] of cases) {
    it(`${name}: every form × option combination has exactly one cell`, () => {
      const shown = rows.flatMap((r) => (r.form ? Object.values(r.cells).map((o) => `${r.form}|${comboKey(FORMS_BY_ID[r.form!], o!)}`) : []));
      const asked = forms.flatMap((f) => allCombos(f).map((o) => `${f.id}|${comboKey(f, o)}`));
      expect([...shown].sort()).toEqual([...asked].sort());
    });
  }
});

describe("every accepted answer has a rule", () => {
  for (const section of SECTIONS) {
    const rows = section.category === "verb" ? VERB_ROWS : ADJ_ROWS;
    it(section.title, () => {
      for (const row of rows) {
        const rules = section.rules[row.id];
        expect(rules, `${row.id} has no rules`).toBeDefined();
        for (const col of COLS.map((c) => c.id)) {
          const opts = row.cells[col];
          const ruleList = rules[col] ?? [];
          const where = `${section.id} ${row.id} ${col}`;
          if (!opts) {
            expect(ruleList, `${where}: rule for a cell the quiz never asks`).toEqual([]);
            continue;
          }
          if (!row.form) {
            expect(ruleList.length, `${where}: reference-only row needs a rule`).toBeGreaterThan(0);
            continue;
          }
          for (const w of section.words) {
            const cell = conjugateCell(w, FORMS_BY_ID[row.form], opts);
            // One rule per accepted answer (none when the combination doesn't exist).
            expect(ruleList.length, `${where} (${w.kana}): answers ${cell?.kana.join(", ") ?? "none"}`).toBe(cell?.kana.length ?? 0);
          }
        }
      }
    });
  }
});

describe("exceptions table", () => {
  it("lists at least one changed answer for every exception word", () => {
    for (const ex of EXCEPTIONS) expect(exceptionDiffs(ex.word).length, ex.word.kana).toBeGreaterThan(0);
  });

  it("shows 行く's て-form", () => {
    const diffs = exceptionDiffs(EXCEPTIONS[0].word);
    expect(diffs.find((d) => d.form === "て" && d.option === "")?.answers).toEqual(["行って"]);
  });
});
