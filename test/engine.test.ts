import { describe, expect, it } from "vitest";
import reference from "./fixtures/reference-answers.json";
import verbs from "../decks/builtin-verbs/words.json";
import adjectives from "../decks/builtin-adjectives/words.json";
import { ALL_FORMS, FORMS_BY_ID, allCombos, comboKey } from "../shared/conjugation/forms";
import { conjugateCell } from "../shared/conjugation/answerKey";
import type { Word } from "../shared/types";

type Ref = Record<string, Record<string, Record<string, { kana: string[]; kanji: string[] } | null>>>;
const ref = reference as Ref;

/** Intentional kana fixes relative to the original: ある's negative conditional/provisional. */
const KANA_DEVIATIONS: Record<string, string[]> = {
  "ある|conditional|neg": ["なかったら"],
  "ある|provisional|neg": ["なければ"],
};

const builtin = [...(verbs.words as Word[]), ...(adjectives.words as Word[])];

describe("engine matches the original site's kana answers", () => {
  for (const word of builtin) {
    it(`${word.kana} (${word.type})`, () => {
      const expected = ref[`${word.kana}|${word.kanji}`];
      expect(expected).toBeDefined();
      for (const form of ALL_FORMS.filter((f) => f.id in expected)) {
        for (const opts of allCombos(form)) {
          const key = comboKey(form, opts);
          const cell = conjugateCell(word, form, opts);
          const dev = KANA_DEVIATIONS[`${word.kana}|${form.id}|${key}`];
          const want = dev ?? expected[form.id][key]?.kana ?? null;
          expect(cell?.kana ?? null, `${form.id} [${key}]`).toEqual(want);
        }
      }
    });
  }
});

const w = (kana: string, kanji: string, type: Word["type"], exception: Word["exception"] = null): Word => ({
  id: kana,
  kana,
  kanji,
  eng: "",
  type,
  exception,
});
const conj = (word: Word, formId: string, opts: Record<string, boolean> = {}) =>
  conjugateCell(word, FORMS_BY_ID[formId], opts);

describe("generalized irregulars and exceptions", () => {
  it("handles any する-compound", () => {
    const ryouri = w("りょうりする", "料<rt>りょう</rt>理<rt>り</rt>する", "irr");
    expect(conj(ryouri, "past")).toEqual({ kana: ["りょうりした"], kanji: ["料<rt>りょう</rt>理<rt>り</rt>した"] });
    expect(conj(ryouri, "potential", { neg: true })?.kana).toEqual(["りょうりできない"]);
    expect(conj(ryouri, "causative")?.kana).toEqual(["りょうりさせる"]);
  });

  it("handles 来る-compounds in kana and kanji", () => {
    const mottekuru = w("もってくる", "持<rt>も</rt>って来<rt>く</rt>る", "irr");
    expect(conj(mottekuru, "negative")).toEqual({ kana: ["もってこない"], kanji: ["持<rt>も</rt>って来<rt>こ</rt>ない"] });
    expect(conj(mottekuru, "imperative")).toEqual({ kana: ["もってこい"], kanji: ["持<rt>も</rt>って来<rt>こ</rt>い"] });
    expect(conj(mottekuru, "te", { neg: true })?.kana).toEqual(["もってこなくて", "もってこないで"]);
  });

  it("fixes the original's 来る kanji bugs", () => {
    const kuru = w("くる", "来<rt>く</rt>る", "irr");
    expect(conj(kuru, "imperative")?.kanji).toEqual(["来<rt>こ</rt>い"]);
    expect(conj(kuru, "potential")?.kanji).toEqual(["来<rt>こ</rt>られる"]);
    const benkyou = w("べんきょうする", "勉<rt>べん</rt>強<rt>きょう</rt>する", "irr");
    expect(conj(benkyou, "imperative")?.kanji).toEqual(["勉<rt>べん</rt>強<rt>きょう</rt>しろ"]);
  });

  it("handles honorific godan verbs (くださる)", () => {
    const kudasaru = w("くださる", "下<rt>くだ</rt>さる", "u", "honorific");
    expect(conj(kudasaru, "polite")?.kana).toEqual(["くださいます"]);
    expect(conj(kudasaru, "imperative")?.kana).toEqual(["ください"]);
    expect(conj(kudasaru, "past")?.kana).toEqual(["くださった"]);
    expect(conj(kudasaru, "negative")?.kana).toEqual(["くださらない"]);
  });

  it("handles adj-ix compounds (かっこいい) and 良い kanji", () => {
    const kakkoii = w("かっこいい", "格好<rt>かっこう</rt>いい", "i", "ii");
    expect(conj(kakkoii, "adj-negative")?.kana).toEqual(["かっこよくない"]);
    expect(conj(kakkoii, "adj-past")?.kana).toEqual(["かっこよかった"]);
    const ii = w("いい", "良<rt>い</rt>い", "i", "ii");
    expect(conj(ii, "adj-negative")?.kanji).toEqual(["良<rt>よ</rt>くない"]);
  });

  it("returns null for impossible combinations", () => {
    expect(conj(w("たべる", "食<rt>た</rt>べる", "ru"), "causative", { short: true, passive: true })).toBeNull();
    expect(conj(w("はなす", "話<rt>はな</rt>す", "u"), "causative", { short: true, passive: true })).toBeNull();
  });
});
