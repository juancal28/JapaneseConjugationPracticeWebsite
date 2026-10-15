export type VerbType = "u" | "ru" | "irr";
export type AdjType = "i" | "na";
export type WordType = VerbType | AdjType;

/**
 * Irregularities a plain type can't express. Set from JMdict tags at import:
 * v5k-s -> iku, v5r-i -> aru, v5aru -> honorific, v1-s -> kureru, adj-ix -> ii.
 */
export type WordException = "iku" | "aru" | "honorific" | "kureru" | "ii" | null;
export const WORD_EXCEPTIONS: Exclude<WordException, null>[] = ["iku", "aru", "honorific", "kureru", "ii"];

export interface WordReview {
  jmdictPos?: string[];
  claudeNote?: string;
  changedByUser?: boolean;
}

export interface Word {
  id: string;
  kana: string;
  /** Kanji with ruby markup, e.g. 食<rt>た</rt>べる. Equal to kana when there is no kanji. */
  kanji: string;
  eng: string;
  type: WordType;
  exception?: WordException;
  review?: WordReview;
}

export interface DeckSource {
  file?: string;
  ankiDeck?: string;
  importedAt?: string;
}

export interface DeckFile {
  name: string;
  slug: string;
  builtin: boolean;
  source?: DeckSource;
  words: Word[];
}

export interface DeckSummary {
  name: string;
  slug: string;
  builtin: boolean;
  wordCount: number;
  verbCount: number;
  adjCount: number;
}

/** One cell of the answer key. null means the combination doesn't exist (e.g. short passive causative of a ru-verb). */
export type AnswerCell = { kana: string[]; kanji: string[] } | null;

/** form id -> combo key ("" | "neg" | "neg+polite" ...) -> answers */
export type WordAnswers = Record<string, Record<string, AnswerCell>>;

export interface AnswerKey {
  engineVersion: number;
  words: Record<string, WordAnswers>;
}

export const isVerbType = (t: WordType): t is VerbType => t === "u" || t === "ru" || t === "irr";
export const isAdjType = (t: WordType): t is AdjType => t === "i" || t === "na";

export const TYPE_LABELS: Record<WordType, string> = {
  u: "う-Verb (Godan)",
  ru: "る-Verb (Ichidan)",
  irr: "Irregular Verb",
  i: "い-Adjective",
  na: "な-Adjective",
};
