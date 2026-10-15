import { isHiragana } from "wanakana";
import { isCleanRuby, stripRuby } from "../shared/ids";
import { WORD_EXCEPTIONS, type Word } from "../shared/types";

const GODAN_ENDINGS = ["う", "く", "ぐ", "す", "つ", "ぬ", "ぶ", "む", "る"];

/** Checks that a word can be conjugated by the engine. Returns a reason, or null if it's fine. */
export function wordProblem(w: Word): string | null {
  if (!w.kana || !isHiragana(w.kana)) return "Reading must be hiragana";
  if (!w.kanji) return "Missing kanji/ruby";
  if (!isCleanRuby(w.kanji)) return "Kanji may only contain text and <rt>/<rb> ruby tags";
  if (typeof w.eng !== "string" || typeof w.id !== "string") return "Missing id or English";
  if (w.exception && !WORD_EXCEPTIONS.includes(w.exception)) return `Unknown exception "${w.exception}"`;
  const surface = stripRuby(w.kanji);
  switch (w.type) {
    case "u":
      if (!GODAN_ENDINGS.includes(w.kana.slice(-1))) return "Godan verbs must end in an う-row kana";
      break;
    case "ru":
      if (!w.kana.endsWith("る")) return "Ichidan verbs must end in る";
      break;
    case "irr":
      if (!/(する|くる)$/.test(w.kana)) return "Irregular verbs must end in する or くる";
      if (!/(する|為る|くる|来る)$/.test(surface)) return "Kanji form must end in する/為る/くる/来る";
      break;
    case "i":
      if (!w.kana.endsWith("い")) return "い-adjectives must end in い";
      break;
    case "na":
      break;
    default:
      return `Unknown type "${(w as Word).type}"`;
  }
  // Verbs and い-adjectives conjugate on their final kana, which must match in both forms.
  if (w.type !== "na" && w.kana.slice(-1) !== surface.slice(-1)) return "Kana and kanji forms must end with the same kana";
  return null;
}

export function validateWords(words: unknown): string[] {
  if (!Array.isArray(words) || words.length === 0) return ["A deck needs at least one word"];
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of words as Word[]) {
    const problem = wordProblem(w);
    if (problem) errors.push(`${w.kana || "?"}: ${problem}`);
    if (ids.has(w.id)) errors.push(`${w.kana}: duplicate word`);
    ids.add(w.id);
  }
  return errors;
}
