import type { WordException, WordType } from "../types";

/**
 * Ported from steven-kraft.com's verb modules. Every form function runs on both
 * the kana string and the ruby-markup kanji string. That works because each
 * conjugatable word ends in kana, so "all but the last character" is the stem
 * in both representations.
 */

export type Opts = Record<string, boolean>;
export type FormResult = string | string[];

export interface WordInfo {
  type: WordType;
  exception?: WordException;
}

export type FormFn = (word: string, info: WordInfo, opts: Opts) => FormResult;

export const A_ROW: Record<string, string> = { く: "か", す: "さ", う: "わ", ぐ: "が", ぶ: "ば", つ: "た", む: "ま", ぬ: "な", る: "ら" };
export const I_ROW: Record<string, string> = { く: "き", す: "し", う: "い", ぐ: "ぎ", ぶ: "び", つ: "ち", む: "み", ぬ: "に", る: "り" };
export const E_ROW: Record<string, string> = { く: "け", す: "せ", う: "え", ぐ: "げ", ぶ: "べ", つ: "て", む: "め", ぬ: "ね", る: "れ" };
export const O_ROW: Record<string, string> = { く: "こ", す: "そ", う: "お", ぐ: "ご", ぶ: "ぼ", つ: "と", む: "も", ぬ: "の", る: "ろ" };

export const stem = (word: string) => word.slice(0, -1);
export const lastchar = (word: string) => word.slice(-1);

/** I-row (ます-stem) ending, honouring v5aru honorific verbs (くださる -> ください). */
export const iRow = (last: string, info: WordInfo) =>
  info.exception === "honorific" && last === "る" ? "い" : I_ROW[last];

/** Godan て/た euphonic changes. `ta` is "た" or "て"; `da` is "だ" or "で". */
export function godanOnbin(word: string, info: WordInfo, ta: string, da: string): string {
  const s = stem(word);
  const last = lastchar(word);
  if (["う", "つ", "る"].includes(last)) return s + "っ" + ta;
  if (["む", "ぶ", "ぬ"].includes(last)) return s + "ん" + da;
  if (last === "く") return info.exception === "iku" ? s + "っ" + ta : s + "い" + ta;
  if (last === "ぐ") return s + "い" + da;
  if (last === "す") return s + "し" + ta;
  return "Error";
}

const SURU_KANJI = "為<rt>す</rt>る";
const KURU_KANJI = "来<rt>く</rt>る";

/**
 * Generalized version of the original's hard-coded `irr` maps: any する-compound
 * or 来る-compound gets its tail replaced by `kana` (e.g. "し", "こさ", "でき").
 * The 為る/来る kanji tails keep their ruby with the reading's first mora.
 */
export function irrStem(word: string, suruKana: string, kuruKana: string): string {
  if (word.endsWith(SURU_KANJI)) {
    const prefix = word.slice(0, -SURU_KANJI.length);
    // できる has no 為 kanji; the original also drops it.
    if (suruKana.startsWith("で")) return prefix + suruKana;
    return prefix + "為<rt>" + suruKana[0] + "</rt>" + suruKana.slice(1);
  }
  if (word.endsWith("する")) return word.slice(0, -2) + suruKana;
  if (word.endsWith(KURU_KANJI)) {
    return word.slice(0, -KURU_KANJI.length) + "来<rt>" + kuruKana[0] + "</rt>" + kuruKana.slice(1);
  }
  if (word.endsWith("くる")) return word.slice(0, -2) + kuruKana;
  throw new Error(`Not an irregular verb: ${word}`);
}

export const isKuru = (word: string) => word.endsWith("くる") || word.endsWith(KURU_KANJI);
