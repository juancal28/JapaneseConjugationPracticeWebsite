import type { FormFn, WordInfo } from "./helpers";

/**
 * Adjective forms, ported from steven-kraft.com/src/components/japanese/adjectives/adj-*.js.
 * The original special-cases only the kana "いい"; here every adj-ix word (いい, かっこいい,
 * 良い with ruby) uses the よ stem, in kana and in kanji.
 */

function iStem(word: string, info: WordInfo): string {
  if (info.exception === "ii" || word === "いい") {
    if (word.endsWith("<rt>い</rt>い")) return word.slice(0, -"<rt>い</rt>い".length) + "<rt>よ</rt>";
    if (word.endsWith("いい")) return word.slice(0, -2) + "よ";
  }
  return word.slice(0, -1);
}

function check(info: WordInfo) {
  if (info.type !== "i" && info.type !== "na") throw new Error("Invalid input");
}

export const adjConditional: FormFn = (word, info, opts) => {
  check(info);
  if (info.type === "i") return [iStem(word, info) + (opts.neg ? "くなければ" : "ければ")];
  return opts.neg
    ? [word + "ではなかったら", word + "じゃなかったら", word + "ではなければ"]
    : [word + "ならば", word + "であれば"];
};

export const adjNaru: FormFn = (word, info, opts) => {
  check(info);
  const ending = opts.polite && opts.neg ? "なりません" : opts.polite ? "なります" : opts.neg ? "ならない" : "なる";
  if (info.type === "i") return iStem(word, info) + "く" + ending;
  return word + "に" + ending;
};

export const adjNegative: FormFn = (word, info, opts) => {
  check(info);
  const ending = opts.polite ? "ありません" : "ない";
  if (info.type === "i") return iStem(word, info) + "く" + ending;
  if (opts.polite) return [word + "では" + ending, word + "じゃ" + ending, word + "じゃないです"];
  return [word + "では" + ending, word + "じゃ" + ending];
};

export const adjPast: FormFn = (word, info, opts) => {
  check(info);
  const endings = {
    i: {
      plain: { pos: ["かった"], neg: ["くなかった"] },
      polite: { pos: ["かったです"], neg: ["くなかったです", "くありませんでした"] },
    },
    na: {
      plain: { pos: ["だった"], neg: ["ではなかった", "じゃなかった"] },
      polite: { pos: ["でした"], neg: ["ではありませんでした", "じゃなかったです"] },
    },
  } as const;
  const base = info.type === "i" ? iStem(word, info) : word;
  const set = endings[info.type as "i" | "na"][opts.polite ? "polite" : "plain"][opts.neg ? "neg" : "pos"];
  return set.map((end) => base + end);
};

export const adjVolitional: FormFn = (word, info, opts) => {
  check(info);
  // The original ignores "polite" for い-adjectives; kept for parity.
  if (info.type === "i") return iStem(word, info) + "かろう";
  return word + (opts.polite ? "でしょう" : "だろう");
};
