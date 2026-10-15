import { conjugateCell } from "@shared/conjugation/answerKey";
import { ADJ_FORMS, VERB_FORMS, allCombos } from "@shared/conjugation/forms";
import { stripRuby } from "@shared/ids";
import { isVerbType, type Word } from "@shared/types";

export interface ExceptionDiff {
  /** Quiz form label, e.g. "て". */
  form: string;
  /** Option labels, e.g. "Negative Polite" ("" for plain). */
  option: string;
  answers: string[];
}

/**
 * Every answer of an exception word that differs from what its type's normal rules give
 * (computed by conjugating the same word without its exception flag).
 */
export function exceptionDiffs(word: Word): ExceptionDiff[] {
  const regular: Word = { ...word, exception: null };
  const forms = isVerbType(word.type) ? VERB_FORMS : ADJ_FORMS;
  const out: ExceptionDiff[] = [];
  for (const form of forms) {
    for (const opts of allCombos(form)) {
      const actual = conjugateCell(word, form, opts);
      const normal = conjugateCell(regular, form, opts);
      if (!actual || JSON.stringify(actual.kana) === JSON.stringify(normal?.kana)) continue;
      out.push({
        form: form.label,
        option: form.subOpts.filter((o) => opts[o.id]).map((o) => o.label).join(" "),
        answers: actual.kanji.map(stripRuby),
      });
    }
  }
  return out;
}
