import { ADJ_FORMS, VERB_FORMS, comboKey, type FormDef } from "@shared/conjugation/forms";
import { isVerbType, type Word, type WordAnswers } from "@shared/types";

export interface Answer {
  kana: string[];
  kanji: string[];
}

/**
 * Port of the original Randomize class (verbs/randomize.js + adjectives/adj-randomize.js).
 * Instead of conjugating on the fly, it looks answers up in the deck's answer key.
 */
export class Randomizer {
  formLabel = "";
  private questionConj = "";

  constructor(private answers: Record<string, WordAnswers>) {}

  getForm() {
    return this.formLabel;
  }

  /** Enabled forms for the word's category; none enabled means all of them (as in the original). */
  private activeForms(word: Word, opts: Record<string, boolean>): FormDef[] {
    const forms = isVerbType(word.type) ? VERB_FORMS : ADJ_FORMS;
    const enabled = forms.filter((f) => opts[f.id]);
    return enabled.length ? enabled : forms;
  }

  private roll(form: FormDef) {
    const opts: Record<string, boolean> = {};
    const labels: string[] = [];
    for (const o of form.subOpts) {
      opts[o.id] = Math.random() >= 0.5;
      if (opts[o.id]) labels.push(o.label);
    }
    return { opts, labels };
  }

  /** Randomize Question: show the word in another conjugated form (or plain). */
  getQuestion(word: Word, kanji: boolean, opts: Record<string, boolean>): string {
    const plain = kanji ? word.kanji : word.kana;
    const candidates: (FormDef | "plain")[] = [...this.activeForms(word, opts), "plain"];
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.questionConj = "";
    if (pick === "plain" || candidates.length <= 2) return plain;
    const cell = this.answers[word.id]?.[pick.id]?.[comboKey(pick, this.roll(pick).opts)];
    // The original could show an empty question for impossible combos; fall back to plain instead.
    if (!cell) return plain;
    this.questionConj = pick.id;
    return (kanji ? cell.kanji : cell.kana)[0];
  }

  /** Returns null when the rolled combination doesn't exist, which makes the caller draw a new word. */
  getAnswer(word: Word, opts: Record<string, boolean>): Answer | null {
    let forms = this.activeForms(word, opts);
    const withoutQuestion = forms.filter((f) => f.id !== this.questionConj);
    if (withoutQuestion.length) forms = withoutQuestion;
    this.questionConj = "";
    const form = forms[Math.floor(Math.random() * forms.length)];
    const { opts: answerOpts, labels } = this.roll(form);
    this.formLabel = (labels.length > 0 ? labels.join(" ") : "") + " " + form.label;
    const cell = this.answers[word.id]?.[form.id]?.[comboKey(form, answerOpts)];
    return cell ?? null;
  }
}

/** Random item that isn't the last one, unless it's the only choice (the original could loop forever). */
export function generateItem<T>(data: T[], lastItem?: T): T {
  if (data.length === 1) return data[0];
  let item: T;
  do {
    item = data[Math.floor(Math.random() * data.length)];
  } while (item === lastItem);
  return item;
}
