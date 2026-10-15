import type { Word, WordException, WordType } from "@shared/types";

/**
 * The reference page mirrors the quiz: one table per word type, one row per quiz form,
 * and columns for the quiz's Negative / Polite options. Every answer the quiz accepts
 * has a rule here; test/reference.test.ts fails if one is missing, so the page can't
 * fall out of sync with the answer keys. Example conjugations come from the engine.
 */

export type Col = "plain" | "neg" | "polite" | "politeNeg";
export const COLS: { id: Col; label: string }[] = [
  { id: "plain", label: "Plain" },
  { id: "neg", label: "Negative" },
  { id: "polite", label: "Polite" },
  { id: "politeNeg", label: "Polite negative" },
];

export type Opts = Record<string, boolean>;

export interface RowDef {
  id: string;
  label: string;
  /** How the row is reached in the quiz settings. */
  quiz: string;
  /** Engine form id; null for reference-only rows (adjective present tense). */
  form: string | null;
  /** Which sub-option combination each column shows. Missing = the quiz never asks it. */
  cells: Partial<Record<Col, Opts>>;
}

const four = (extra: Opts = {}): Partial<Record<Col, Opts>> => ({
  plain: { ...extra },
  neg: { ...extra, neg: true },
  polite: { ...extra, polite: true },
  politeNeg: { ...extra, neg: true, polite: true },
});

export const VERB_ROWS: RowDef[] = [
  { id: "polite", label: "Polite (ます)", quiz: "Polite Form", form: "polite", cells: { polite: {}, politeNeg: { neg: true } } },
  { id: "negative", label: "Negative (ない)", quiz: "Negative Form", form: "negative", cells: { neg: {}, politeNeg: { polite: true } } },
  { id: "past", label: "Past", quiz: "Past Form", form: "past", cells: four() },
  { id: "te", label: "て", quiz: "て Form", form: "te", cells: four() },
  { id: "potential", label: "Potential", quiz: "Potential Form", form: "potential", cells: four() },
  { id: "volitional", label: "Volitional", quiz: "Volitional Form", form: "volitional", cells: { plain: {}, polite: { polite: true } } },
  { id: "imperative", label: "Imperative", quiz: "Imperative Form", form: "imperative", cells: four() },
  { id: "provisional", label: "Provisional (ば)", quiz: "Provisional Form", form: "provisional", cells: four() },
  { id: "conditional", label: "Conditional (たら)", quiz: "Conditional Form", form: "conditional", cells: four() },
  { id: "passive", label: "Passive", quiz: "Passive Form", form: "passive", cells: four() },
  { id: "causative", label: "Causative", quiz: "Causative Form", form: "causative", cells: four() },
  { id: "causativeShort", label: "Causative (short)", quiz: "Causative + Short", form: "causative", cells: four({ short: true }) },
  { id: "causativePassive", label: "Causative-passive", quiz: "Causative + Passive", form: "causative", cells: four({ passive: true }) },
  {
    id: "causativePassiveShort",
    label: "Causative-passive (short)",
    quiz: "Causative + Short + Passive",
    form: "causative",
    cells: four({ short: true, passive: true }),
  },
];

export const ADJ_ROWS: RowDef[] = [
  { id: "present", label: "Present", quiz: "(not quizzed)", form: null, cells: { plain: {}, polite: {} } },
  { id: "negative", label: "Negative", quiz: "Adj. Negative Form", form: "adj-negative", cells: { neg: {}, politeNeg: { polite: true } } },
  { id: "past", label: "Past", quiz: "Adj. Past Form", form: "adj-past", cells: four() },
  { id: "conditional", label: "Conditional", quiz: "Adj. Conditional Form", form: "adj-conditional", cells: { plain: {}, neg: { neg: true } } },
  { id: "naru", label: "なる (becoming)", quiz: "Adj. なる Form", form: "adj-naruform", cells: four() },
  { id: "volitional", label: "Volitional", quiz: "Adj. Volitional Form", form: "adj-volitional", cells: { plain: {}, polite: { polite: true } } },
];

/** Rules for one cell: one string per accepted answer, in the engine's answer order. */
export type CellRules = Partial<Record<Col, string[]>>;

export interface Section {
  id: string;
  title: string;
  subtitle: string;
  category: "verb" | "adj";
  /** Example words; irregulars show two (する and 来る) side by side. */
  words: Word[];
  rules: Record<string, CellRules>;
}

const word = (kana: string, kanji: string, type: WordType, exception: WordException = null): Word => ({
  id: kana,
  kana,
  kanji,
  eng: "",
  type,
  exception,
});

export const KAKU = word("かく", "書<rt>か</rt>く", "u");
export const TABERU = word("たべる", "食<rt>た</rt>べる", "ru");
export const SURU = word("する", "する", "irr");
export const KURU = word("くる", "来<rt>く</rt>る", "irr");
export const TAKAI = word("たかい", "高<rt>たか</rt>い", "i");
export const SHIZUKA = word("しずか", "静<rt>しず</rt>か", "na");

const GODAN: Record<string, CellRules> = {
  polite: { polite: ["i + ます"], politeNeg: ["i + ません"] },
  negative: { neg: ["a + ない"], politeNeg: ["i + ません"] },
  past: { plain: ["sound change + た"], neg: ["a + なかった"], polite: ["i + ました"], politeNeg: ["i + ませんでした"] },
  te: { plain: ["sound change + て"], neg: ["a + なくて", "a + ないで"], polite: ["i + まして"], politeNeg: ["i + ませんで"] },
  potential: { plain: ["e + る"], neg: ["e + ない"], polite: ["e + ます"], politeNeg: ["e + ません"] },
  volitional: { plain: ["o + う"], polite: ["i + ましょう"] },
  imperative: {
    plain: ["e"],
    neg: ["dictionary + な"],
    polite: ["i + なさい", "て form + ください"],
    politeNeg: ["i + なさるな", "a + ない + でください"],
  },
  provisional: { plain: ["e + ば"], neg: ["a + なければ"], polite: ["i + ますなら"], politeNeg: ["i + ませんなら"] },
  conditional: { plain: ["sound change + たら"], neg: ["a + なかったら"], polite: ["i + ましたら"], politeNeg: ["i + ませんでしたら"] },
  passive: { plain: ["a + れる"], neg: ["a + れない"], polite: ["a + れます"], politeNeg: ["a + れません"] },
  causative: { plain: ["a + せる"], neg: ["a + せない"], polite: ["a + せます"], politeNeg: ["a + せません"] },
  causativeShort: { plain: ["a + す"], neg: ["a + さない"], polite: ["a + します"], politeNeg: ["a + しません"] },
  causativePassive: { plain: ["a + せられる"], neg: ["a + せられない"], polite: ["a + せられます"], politeNeg: ["a + せられません"] },
  causativePassiveShort: {
    plain: ["a + される (not for す-verbs)"],
    neg: ["a + されない (not for す-verbs)"],
    polite: ["a + されます (not for す-verbs)"],
    politeNeg: ["a + されません (not for す-verbs)"],
  },
};

const ICHIDAN: Record<string, CellRules> = {
  polite: { polite: ["stem + ます"], politeNeg: ["stem + ません"] },
  negative: { neg: ["stem + ない"], politeNeg: ["stem + ません"] },
  past: { plain: ["stem + た"], neg: ["stem + なかった"], polite: ["stem + ました"], politeNeg: ["stem + ませんでした"] },
  te: { plain: ["stem + て"], neg: ["stem + なくて", "stem + ないで"], polite: ["stem + まして"], politeNeg: ["stem + ませんで"] },
  potential: {
    plain: ["stem + られる", "stem + れる (casual)"],
    neg: ["stem + られない", "stem + れない (casual)"],
    polite: ["stem + られます", "stem + れます (casual)"],
    politeNeg: ["stem + られません", "stem + れません (casual)"],
  },
  volitional: { plain: ["stem + よう"], polite: ["stem + ましょう"] },
  imperative: {
    plain: ["stem + ろ"],
    neg: ["dictionary + な"],
    polite: ["stem + なさい", "stem + て + ください"],
    politeNeg: ["stem + なさるな", "stem + ない + でください"],
  },
  provisional: { plain: ["stem + れば"], neg: ["stem + なければ"], polite: ["stem + ますなら"], politeNeg: ["stem + ませんなら"] },
  conditional: { plain: ["stem + たら"], neg: ["stem + なかったら"], polite: ["stem + ましたら"], politeNeg: ["stem + ませんでしたら"] },
  passive: { plain: ["stem + られる"], neg: ["stem + られない"], polite: ["stem + られます"], politeNeg: ["stem + られません"] },
  causative: { plain: ["stem + させる"], neg: ["stem + させない"], polite: ["stem + させます"], politeNeg: ["stem + させません"] },
  causativeShort: { plain: ["stem + さす"], neg: ["stem + ささない"], polite: ["stem + さします"], politeNeg: ["stem + さしません"] },
  causativePassive: {
    plain: ["stem + させられる"],
    neg: ["stem + させられない"],
    polite: ["stem + させられます"],
    politeNeg: ["stem + させられません"],
  },
  // No short causative-passive for ichidan verbs.
  causativePassiveShort: {},
};

/** Irregular rules read "する form / 来る form". */
const IRREGULAR: Record<string, CellRules> = {
  polite: { polite: ["し / き + ます"], politeNeg: ["し / き + ません"] },
  negative: { neg: ["し / こ + ない"], politeNeg: ["し / き + ません"] },
  past: { plain: ["し / き + た"], neg: ["し / こ + なかった"], polite: ["し / き + ました"], politeNeg: ["し / き + ませんでした"] },
  te: {
    plain: ["し / き + て"],
    neg: ["し / こ + なくて", "し / こ + ないで"],
    polite: ["し / き + まして"],
    politeNeg: ["し / き + ませんで"],
  },
  potential: { plain: ["できる / こられる"], neg: ["できない / こられない"], polite: ["できます / こられます"], politeNeg: ["できません / こられません"] },
  volitional: { plain: ["しよう / こよう"], polite: ["し / き + ましょう"] },
  imperative: {
    plain: ["しろ / こい"],
    neg: ["dictionary + な"],
    polite: ["し / き + なさい", "して / きて + ください"],
    politeNeg: ["し / き + なさるな", "しない / こない + でください"],
  },
  provisional: { plain: ["すれば / くれば"], neg: ["し / こ + なければ"], polite: ["し / き + ますなら"], politeNeg: ["し / き + ませんなら"] },
  conditional: { plain: ["し / き + たら"], neg: ["し / こ + なかったら"], polite: ["し / き + ましたら"], politeNeg: ["し / き + ませんでしたら"] },
  passive: { plain: ["される / こられる"], neg: ["されない / こられない"], polite: ["されます / こられます"], politeNeg: ["されません / こられません"] },
  causative: { plain: ["させる / こさせる"], neg: ["させない / こさせない"], polite: ["させます / こさせます"], politeNeg: ["させません / こさせません"] },
  causativeShort: { plain: ["さす / こさす"], neg: ["ささない / こささない"], polite: ["さします / こさします"], politeNeg: ["さしません / こさしません"] },
  causativePassive: {
    plain: ["させられる / こさせられる"],
    neg: ["させられない / こさせられない"],
    polite: ["させられます / こさせられます"],
    politeNeg: ["させられません / こさせられません"],
  },
  causativePassiveShort: {},
};

const I_ADJ: Record<string, CellRules> = {
  present: { plain: ["dictionary (〜い)"], polite: ["dictionary + です"] },
  negative: { neg: ["stem + くない"], politeNeg: ["stem + くありません", "stem + くないです"] },
  past: { plain: ["stem + かった"], neg: ["stem + くなかった"], polite: ["stem + かったです"], politeNeg: ["stem + くなかったです", "stem + くありませんでした"] },
  conditional: { plain: ["stem + ければ"], neg: ["stem + くなければ"] },
  naru: { plain: ["stem + くなる"], neg: ["stem + くならない"], polite: ["stem + くなります"], politeNeg: ["stem + くなりません"] },
  volitional: { plain: ["stem + かろう"], polite: ["stem + かろう (no separate polite form)"] },
};

const NA_ADJ: Record<string, CellRules> = {
  present: { plain: ["+ だ"], polite: ["+ です"] },
  negative: { neg: ["+ ではない", "+ じゃない"], politeNeg: ["+ ではありません", "+ じゃありません", "+ じゃないです"] },
  past: { plain: ["+ だった"], neg: ["+ ではなかった", "+ じゃなかった"], polite: ["+ でした"], politeNeg: ["+ ではありませんでした", "+ じゃなかったです"] },
  conditional: { plain: ["+ ならば", "+ であれば"], neg: ["+ ではなかったら", "+ じゃなかったら", "+ ではなければ"] },
  naru: { plain: ["+ になる"], neg: ["+ にならない"], polite: ["+ になります"], politeNeg: ["+ になりません"] },
  volitional: { plain: ["+ だろう"], polite: ["+ でしょう"] },
};

export const SECTIONS: Section[] = [
  {
    id: "godan",
    title: "Godan verbs (う-verbs)",
    subtitle: "Change the final kana to another vowel row: 書く → か / き / け / こ.",
    category: "verb",
    words: [KAKU],
    rules: GODAN,
  },
  {
    id: "ichidan",
    title: "Ichidan verbs (る-verbs)",
    subtitle: "Drop る to get the stem, then add the ending: 食べる → 食べ.",
    category: "verb",
    words: [TABERU],
    rules: ICHIDAN,
  },
  {
    id: "irregular",
    title: "Irregular verbs (する, 来る)",
    subtitle: "Also any する-verb (勉強する) and 来る-compound (持って来る). Rules read する form / 来る form.",
    category: "verb",
    words: [SURU, KURU],
    rules: IRREGULAR,
  },
  {
    id: "i-adj",
    title: "い-adjectives",
    subtitle: "Drop the final い to get the stem: 高い → 高.",
    category: "adj",
    words: [TAKAI],
    rules: I_ADJ,
  },
  {
    id: "na-adj",
    title: "な-adjectives",
    subtitle: "Endings attach straight to the word: 静か → 静かだ.",
    category: "adj",
    words: [SHIZUKA],
    rules: NA_ADJ,
  },
];

/** Words whose answers break their type's rules, with what changes. */
export interface ExceptionDef {
  word: Word;
  note: string;
}

export const EXCEPTIONS: ExceptionDef[] = [
  { word: word("いく", "行<rt>い</rt>く", "u", "iku"), note: "て/た forms use っ like う/つ/る verbs, not いて/いた." },
  { word: word("ある", "ある", "u", "aru"), note: "The negative is ない, not あらない, and everything built on it follows." },
  { word: word("くださる", "くださる", "u", "honorific"), note: "The ます-stem is い, not り, and the imperative is ください (polite: くださいませ). Same for いらっしゃる, おっしゃる, なさる." },
  { word: word("くれる", "くれる", "ru", "kureru"), note: "The plain imperative is くれ (くれろ is also accepted)." },
  { word: word("いい", "いい", "i", "ii"), note: "The stem is よ, not い. Same for compounds like かっこいい." },
];

/** Adjective present tense isn't produced by the engine; build it here. */
export function presentForms(w: Word): Partial<Record<Col, string[]>> {
  return w.type === "i" ? { plain: [w.kanji], polite: [w.kanji + "です"] } : { plain: [w.kanji + "だ"], polite: [w.kanji + "です"] };
}
