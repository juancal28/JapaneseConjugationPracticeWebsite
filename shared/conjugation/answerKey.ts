import { isVerbType, type AnswerCell, type AnswerKey, type Word, type WordAnswers } from "../types";
import { ADJ_FORMS, VERB_FORMS, allCombos, comboKey, type FormDef } from "./forms";
import type { FormResult } from "./helpers";

/** Bump when the engine's output changes, then run `npm run keys:rebuild`. */
export const ENGINE_VERSION = 1;

const toList = (r: FormResult): string[] => (Array.isArray(r) ? r : [r]);

export function conjugateCell(word: Word, form: FormDef, opts: Record<string, boolean>): AnswerCell {
  const info = { type: word.type, exception: word.exception ?? null };
  const kana = form.fn(word.kana, info, opts);
  if (kana === "") return null;
  return { kana: toList(kana), kanji: toList(form.fn(word.kanji, info, opts)) };
}

export function buildWordAnswers(word: Word): WordAnswers {
  const forms = isVerbType(word.type) ? VERB_FORMS : ADJ_FORMS;
  const answers: WordAnswers = {};
  for (const form of forms) {
    answers[form.id] = {};
    for (const opts of allCombos(form)) {
      answers[form.id][comboKey(form, opts)] = conjugateCell(word, form, opts);
    }
  }
  return answers;
}

export function buildAnswerKey(words: Word[]): AnswerKey {
  const key: AnswerKey = { engineVersion: ENGINE_VERSION, words: {} };
  for (const w of words) key.words[w.id] = buildWordAnswers(w);
  return key;
}
