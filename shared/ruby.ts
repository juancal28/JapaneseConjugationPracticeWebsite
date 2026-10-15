/** Builds the ruby markup the engine works on, e.g. alignRuby("食べる", "たべる") -> "食<rt>た</rt>べる". */

const KANJI_RE = /[\p{Script=Han}々〆ヵヶ]/u;
const isKanji = (ch: string) => KANJI_RE.test(ch);

/** Katakana -> hiragana, leaving everything else alone. */
export const kataToHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface RubyResult {
  ruby: string;
  /** False when the reading couldn't be lined up with the kana in the surface form. */
  aligned: boolean;
}

export function alignRuby(surface: string, reading: string): RubyResult {
  if (!surface) return { ruby: reading, aligned: true };
  if (![...surface].some(isKanji)) return { ruby: surface, aligned: kataToHira(surface) === reading || !reading };
  if (!reading) return { ruby: surface, aligned: false };

  // Split into alternating kanji / kana runs.
  const runs: { kanji: boolean; text: string }[] = [];
  for (const ch of surface) {
    const k = isKanji(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === k) last.text += ch;
    else runs.push({ kanji: k, text: ch });
  }

  // Kana runs anchor the reading; each kanji run takes what's between the anchors.
  const pattern = "^" + runs.map((r) => (r.kanji ? "(.+?)" : escapeRe(kataToHira(r.text)))).join("") + "$";
  const m = new RegExp(pattern, "u").exec(reading);
  if (m) {
    let g = 1;
    return { ruby: runs.map((r) => (r.kanji ? `${r.text}<rt>${m[g++]}</rt>` : r.text)).join(""), aligned: true };
  }

  // Fallback: keep the shared trailing kana (okurigana) outside the ruby so the word still
  // ends in kana, and put the rest of the reading over the rest of the surface.
  let i = 0;
  const s = [...surface];
  const r = [...reading];
  while (i < s.length && i < r.length && !isKanji(s[s.length - 1 - i]) && kataToHira(s[s.length - 1 - i]) === r[r.length - 1 - i]) i++;
  const head = s.slice(0, s.length - i).join("");
  const tail = s.slice(s.length - i).join("");
  const headReading = r.slice(0, r.length - i).join("");
  return { ruby: `${head}<rt>${headReading}</rt>${tail}`, aligned: false };
}
