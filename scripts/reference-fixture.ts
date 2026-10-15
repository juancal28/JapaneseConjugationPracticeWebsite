/**
 * Runs the ORIGINAL steven-kraft.com conjugation modules over the built-in word
 * lists for every form and sub-opt combination and writes the results to
 * test/fixtures/reference-answers.json. That fixture is the golden data the
 * engine test compares against. Only the generated data is committed, not the original code.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ALL_FORMS, allCombos, comboKey } from "../shared/conjugation/forms";
import { CHUNKS, extractModules, fetchReference, readWordList } from "./reference-data";

const MODULE_FOR_FORM: Record<string, string> = {
  causative: "causativeform",
  conditional: "conditionalform",
  imperative: "imperativeform",
  negative: "negativeform",
  passive: "passiveform",
  past: "pastform",
  polite: "politeform",
  potential: "potentialform",
  provisional: "provisionalform",
  te: "teform",
  volitional: "volitionalform",
  "adj-conditional": "adj-conditionalform",
  "adj-naruform": "adj-naruform",
  "adj-negative": "adj-negativeform",
  "adj-past": "adj-pastform",
  "adj-volitional": "adj-volitionalform",
};

type Fixture = Record<string, Record<string, Record<string, { kana: string[]; kanji: string[] } | null>>>;

await fetchReference();
const fixture: Fixture = {};
for (const kind of Object.keys(CHUNKS) as (keyof typeof CHUNKS)[]) {
  const files = extractModules(kind);
  const words = readWordList(kind);
  for (const form of ALL_FORMS.filter((f) => (kind === "verb") === (f.appliesTo === "verb"))) {
    const mod = await import(pathToFileURL(files[MODULE_FOR_FORM[form.id]]).href);
    const getAnswer = mod.default.getAnswer;
    for (const w of words) {
      const id = `${w.kana}|${w.kanji}`;
      fixture[id] ??= {};
      fixture[id][form.id] = {};
      for (const opts of allCombos(form)) {
        const list = (r: string | string[]) => (Array.isArray(r) ? r : [r]);
        const kana = getAnswer(w.kana, w.type, opts);
        fixture[id][form.id][comboKey(form, opts)] =
          kana === "" ? null : { kana: list(kana), kanji: list(getAnswer(w.kanji, w.type, opts)) };
      }
    }
  }
}
fs.mkdirSync("test/fixtures", { recursive: true });
fs.writeFileSync("test/fixtures/reference-answers.json", JSON.stringify(fixture) + "\n");
console.log(`Wrote reference answers for ${Object.keys(fixture).length} words`);
