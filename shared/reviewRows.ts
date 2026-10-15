import { stripRuby, wordId } from "./ids";
import type { ReviewRow } from "./importTypes";
import { alignRuby } from "./ruby";
import type { Word } from "./types";
import { wordProblem } from "./validate";

/** Why an included row can't be saved, or null. */
export function rowProblem(row: ReviewRow): string | null {
  if (!row.include || row.type === "skip") return null;
  return wordProblem({ id: "", kana: row.kana, kanji: row.kanji, eng: row.eng, type: row.type, exception: row.exception });
}

/** Rebuilds the ruby markup after the kana or kanji surface was edited. */
export function realign(row: ReviewRow): ReviewRow {
  return { ...row, kanji: alignRuby(row.kanjiSurface || row.kana, row.kana).ruby };
}

export const rowIncluded = (row: ReviewRow) => row.include && row.type !== "skip";

export function rowToWord(row: ReviewRow, changedByUser: boolean): Word {
  if (row.type === "skip") throw new Error("Skipped rows aren't words");
  return {
    id: wordId(row.kana, row.kanji),
    kana: row.kana,
    kanji: row.kanji,
    eng: row.eng,
    type: row.type,
    exception: row.exception,
    review: {
      jmdictPos: row.jmdict.candidates[0]?.pos,
      claudeNote: row.claude?.note || undefined,
      changedByUser: changedByUser || undefined,
    },
  };
}

/** Existing deck word -> editable row (for editing a saved deck). */
export function wordToRow(word: Word): ReviewRow {
  return {
    rowId: word.id,
    include: true,
    kana: word.kana,
    kanjiSurface: stripRuby(word.kanji),
    kanji: word.kanji,
    eng: word.eng,
    type: word.type,
    exception: word.exception ?? null,
    raw: { expression: stripRuby(word.kanji), reading: word.kana, meaning: word.eng },
    jmdict: { candidates: word.review?.jmdictPos ? [{ kanji: [], kana: [], pos: word.review.jmdictPos, gloss: "" }] : [], suggestedType: null },
    claude: word.review?.claudeNote ? { type: word.type, confidence: "high", note: word.review.claudeNote } : null,
    flags: [],
  };
}
