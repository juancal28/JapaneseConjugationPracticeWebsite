import { kataToHira } from "../../shared/ruby";
import type { FieldMapping } from "../../shared/importTypes";

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** HTML field value -> plain text: drops tags, [sound:...] and decodes entities. */
export function cleanField(html: string): string {
  return html
    .replace(/\[sound:[^\]]*\]/g, " ")
    .replace(/<br\s*\/?>|<\/div>|<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#") && e !== "#39") return String.fromCodePoint(parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const JP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々ー]/u;
const KANJI = /[\p{Script=Han}々]/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const LATIN = /[A-Za-z]/;

export interface CleanWord {
  surface: string;
  /** Hiragana reading taken from Anki furigana brackets, if present. */
  bracketReading: string;
  /** Problems worth showing in the review table. */
  flags: string[];
}

/**
 * Turns an expression field into a single dictionary-form word:
 *  - Anki furigana syntax " 食[た]べ 物[もの]" -> surface 食べ物, reading たべもの
 *  - strips 〜 prefixes and (parenthetical) notes
 *  - keeps the first of several comma-separated words (flagged)
 */
export function cleanExpression(text: string): CleanWord {
  const flags: string[] = [];
  let t = text.replace(/[（(][^）)]*[）)]/g, " ").replace(/^[\s〜～~]+/, "").trim();
  const parts = t.split(/\s*[、,;；／/]\s*/).filter(Boolean);
  if (parts.length > 1) {
    flags.push(`Card has several words; using the first ("${parts[0]}")`);
    t = parts[0];
  }
  let bracketReading = "";
  if (/\[[^\]]+\]/.test(t)) {
    bracketReading = kataToHira(
      t.replace(/([^\s[\]]*?)([\p{Script=Han}々]+)\[([^\]]+)\]/gu, (_m, lead: string, _kanji: string, reading: string) => lead + reading).replace(/\s+/g, ""),
    );
    t = t.replace(/\[[^\]]*\]/g, "");
  }
  const surface = t.replace(/\s+/g, "").replace(/[。！？!?]$/, "");
  return { surface, bracketReading, flags };
}

/** Reading field -> hiragana (first reading if several). */
export function cleanReading(text: string): string {
  const first = text.replace(/[（(][^）)]*[）)]/g, "").split(/[、,;；／/・\s]+/).filter(Boolean)[0] ?? "";
  // Strip furigana brackets if the reading field itself uses them.
  return kataToHira(first.replace(/[^\s[\]]*\[([^\]]+)\]/g, "$1").replace(/^[〜～~]/, ""));
}

const NAME_HINTS = {
  expression: /expression|vocab|word|kanji|japanese|front|term|単語|表現|日本語|漢字/i,
  reading: /reading|kana|furigana|hiragana|yomi|読み|ふりがな|かな/i,
  meaning: /meaning|english|definition|gloss|translation|back|意味|英語/i,
};

/** Guesses which field holds the word, its reading and its English meaning. */
export function detectMapping(fieldNames: string[], samples: string[][]): FieldMapping {
  const n = fieldNames.length;
  const share = (i: number, test: (v: string) => boolean) => {
    const values = samples.map((s) => s[i] ?? "").filter(Boolean);
    return values.length ? values.filter(test).length / values.length : 0;
  };
  const score = (i: number, kind: keyof typeof NAME_HINTS) => {
    const hint = NAME_HINTS[kind].test(fieldNames[i]) ? 0.5 : 0;
    if (kind === "expression") return hint + share(i, (v) => JP.test(v) && !LATIN.test(v)) + 0.5 * share(i, (v) => KANJI.test(v));
    if (kind === "reading") return hint + share(i, (v) => KANA_ONLY.test(v.replace(/\s/g, "")));
    return hint + share(i, (v) => LATIN.test(v) && !JP.test(v));
  };
  const pick = (kind: keyof typeof NAME_HINTS, taken: (number | null)[], min: number) => {
    let best: number | null = null;
    let bestScore = min;
    for (let i = 0; i < n; i++) {
      if (taken.includes(i)) continue;
      const s = score(i, kind);
      if (s > bestScore) [best, bestScore] = [i, s];
    }
    return best;
  };
  const expression = pick("expression", [], 0.4);
  const meaning = pick("meaning", [expression], 0.4);
  const reading = pick("reading", [expression, meaning], 0.6);
  return { expression, reading, meaning };
}
