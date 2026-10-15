import { A_ROW, E_ROW, O_ROW, godanOnbin, iRow, irrStem, isKuru, lastchar, stem, type FormFn } from "./helpers";

/**
 * Verb forms, ported from steven-kraft.com/src/components/japanese/verbs/*.js.
 * Kana output matches the original for every built-in verb (see test/engine.test.ts);
 * deviations are commented inline.
 */

export const causative: FormFn = (word, info, opts) => {
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    let presuff = opts.short ? "し" : "せ";
    if (opts.passive) presuff = "せられ";
    if (opts.passive && opts.short) {
      presuff = "され";
      if (last === "す") return "";
    }
    const shortEnd = opts.passive ? "される" : "す";
    const shortNegEnd = opts.passive ? "されない" : "さない";
    const root = s + A_ROW[last];
    if (opts.short && opts.polite && opts.neg) return root + presuff + "ません";
    if (opts.short && opts.polite) return root + presuff + "ます";
    if (opts.polite && opts.neg) return root + presuff + "ません";
    if (opts.short && opts.neg) return root + shortNegEnd;
    if (opts.short) return root + shortEnd;
    if (opts.polite) return root + presuff + "ます";
    if (opts.neg) return root + presuff + "ない";
    return root + presuff + "る";
  }
  if (opts.passive && opts.short) return "";
  const root = info.type === "ru" ? s + "さ" : irrStem(word, "さ", "こさ");
  if (opts.passive) {
    if (opts.polite && opts.neg) return root + "せられません";
    if (opts.polite) return root + "せられます";
    if (opts.neg) return root + "せられない";
    return root + "せられる";
  }
  if (opts.short && opts.polite && opts.neg) return root + "しません";
  if (opts.short && opts.polite) return root + "します";
  if (opts.polite && opts.neg) return root + "せません";
  if (opts.short && opts.neg) return root + "さない";
  if (opts.short) return root + "す";
  if (opts.polite) return root + "せます";
  if (opts.neg) return root + "せない";
  return root + "せる";
};

export const conditional: FormFn = (word, info, opts) => {
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    if (opts.polite && opts.neg) return s + iRow(last, info) + "ませんでしたら";
    // Deviation: the original gives あらなかったら for ある.
    if (opts.neg) return info.exception === "aru" ? "なかったら" : s + A_ROW[last] + "なかったら";
    if (opts.polite) return s + iRow(last, info) + "ましたら";
    return godanOnbin(word, info, "たら", "だら");
  }
  if (info.type === "ru") {
    if (opts.polite && opts.neg) return s + "ませんでしたら";
    if (opts.neg) return s + "なかったら";
    if (opts.polite) return s + "ましたら";
    return s + "たら";
  }
  if (opts.polite && opts.neg) return irrStem(word, "し", "き") + "ませんでしたら";
  if (opts.polite) return irrStem(word, "し", "き") + "ましたら";
  if (opts.neg) return irrStem(word, "し", "こ") + "なかったら";
  return irrStem(word, "し", "き") + "たら";
};

export const imperative: FormFn = (word, info, opts) => {
  if (opts.neg && !opts.polite) return word + "な";
  // Deviations: polite also accepts the request forms textbooks teach as the polite
  // imperative, after the original's 〜なさい / 〜なさるな:
  //   〜てください (書いてください) and, negative, 〜ないでください (書かないでください).
  if (opts.polite && !opts.neg) return [...toList(nasai(word, info)), toList(te(word, info, {}))[0] + "ください"];
  if (opts.polite && opts.neg) return [...toList(nasai(word, info, opts)), toList(negative(word, info, {}))[0] + "でください"];
  return nasai(word, info, opts);
};

const toList = (r: string | string[]) => (Array.isArray(r) ? r : [r]);

/** The original's imperative: plain 書け, polite 書きなさい, polite negative 書きなさるな. */
const nasai = (word: string, info: Parameters<FormFn>[1], opts: Parameters<FormFn>[2] = { polite: true }): string | string[] => {
  const s = stem(word);
  const ending = opts.polite && opts.neg ? "なさるな" : opts.polite ? "なさい" : "ろ";
  if (info.type === "u") {
    const last = lastchar(word);
    if (opts.polite) return s + iRow(last, info) + ending;
    if (info.exception === "honorific") return s + "い";
    return s + E_ROW[last];
  }
  if (info.type === "ru") {
    if (info.exception === "kureru") {
      if (opts.polite) return s + "なさるな";
      return [s, s + "ろ"];
    }
    return s + ending;
  }
  if (!opts.polite && isKuru(word)) return irrStem(word, "し", "こい");
  return irrStem(word, "し", "き") + ending;
};

export const negative: FormFn = (word, info, opts) => {
  const ending = opts.polite ? "ません" : "ない";
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    if (info.exception === "aru" && !opts.polite) return "ない";
    return s + (opts.polite ? iRow(last, info) : A_ROW[last]) + ending;
  }
  if (info.type === "ru") return s + ending;
  return irrStem(word, "し", opts.polite ? "き" : "こ") + ending;
};

export const passive: FormFn = (word, info, opts) => {
  const ending = opts.polite && opts.neg ? "ません" : opts.polite ? "ます" : opts.neg ? "ない" : "る";
  const s = stem(word);
  if (info.type === "u") return s + A_ROW[lastchar(word)] + "れ" + ending;
  if (info.type === "ru") return s + "られ" + ending;
  return irrStem(word, "さ", "こら") + "れ" + ending;
};

export const past: FormFn = (word, info, opts) => {
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    if (opts.polite && opts.neg) return s + iRow(last, info) + "ませんでした";
    if (opts.polite) return s + iRow(last, info) + "ました";
    if (opts.neg) return info.exception === "aru" ? "なかった" : s + A_ROW[last] + "なかった";
    return godanOnbin(word, info, "た", "だ");
  }
  const base = info.type === "irr" ? irrStem(word, "し", !opts.polite && opts.neg ? "こ" : "き") : s;
  if (opts.polite && opts.neg) return base + "ませんでした";
  if (opts.polite) return base + "ました";
  if (opts.neg) return base + "なかった";
  return base + "た";
};

export const polite: FormFn = (word, info, opts) => {
  const ending = opts.neg ? "ません" : "ます";
  if (info.type === "u") return stem(word) + iRow(lastchar(word), info) + ending;
  if (info.type === "irr") return irrStem(word, "し", "き") + ending;
  return stem(word) + ending;
};

export const potential: FormFn = (word, info, opts) => {
  const ending = opts.polite && opts.neg ? "ません" : opts.polite ? "ます" : opts.neg ? "ない" : "る";
  const s = stem(word);
  if (info.type === "u") return s + E_ROW[lastchar(word)] + ending;
  if (info.type === "ru") return [s + "られ" + ending, s + "れ" + ending];
  return irrStem(word, "でき", "こられ") + ending;
};

export const provisional: FormFn = (word, info, opts) => {
  const s = stem(word);
  const last = lastchar(word);
  let ending: string;
  let row: Record<string, string> | null = null;
  if (opts.polite && opts.neg) ending = "ませんなら";
  else if (opts.polite) ending = "ますなら";
  else if (opts.neg) {
    ending = "なければ";
    row = A_ROW;
  } else {
    ending = info.type === "u" ? "ば" : "れば";
    row = E_ROW;
  }
  if (info.type === "u") {
    // Deviation: the original gives あらなければ for ある.
    if (info.exception === "aru" && opts.neg && !opts.polite) return "なければ";
    return s + (opts.polite ? iRow(last, info) : row![last]) + ending;
  }
  if (info.type === "ru") return s + ending;
  if (opts.neg && !opts.polite && isKuru(word)) return irrStem(word, "し", "こ") + ending;
  if (opts.polite || opts.neg) return irrStem(word, "し", "き") + ending;
  return s + ending;
};

export const te: FormFn = (word, info, opts) => {
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    if (info.exception === "aru" && opts.neg && !opts.polite) return "なくて";
    if (opts.neg && opts.polite) return s + iRow(last, info) + "ませんで";
    if (opts.neg) {
      const negStem = s + A_ROW[last] + "な";
      return [negStem + "くて", negStem + "いで"];
    }
    if (opts.polite) return s + iRow(last, info) + "まして";
    return godanOnbin(word, info, "て", "で");
  }
  const base = info.type === "irr" ? irrStem(word, "し", opts.neg && !opts.polite ? "こ" : "き") : s;
  if (opts.neg && opts.polite) return base + "ませんで";
  if (opts.neg) return [base + "なくて", base + "ないで"];
  if (opts.polite) return base + "まして";
  return base + "て";
};

export const volitional: FormFn = (word, info, opts) => {
  const s = stem(word);
  if (info.type === "u") {
    const last = lastchar(word);
    return opts.polite ? s + iRow(last, info) + "ましょう" : s + O_ROW[last] + "う";
  }
  if (info.type === "ru") return opts.polite ? s + "ましょう" : s + "よう";
  return opts.polite ? irrStem(word, "し", "き") + "ましょう" : irrStem(word, "し", "こ") + "よう";
};
