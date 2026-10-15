/** Removes ruby markup: 食<rt>た</rt>べる -> 食べる. */
export const stripRuby = (s: string) => s.replace(/<rt>.*?<\/rt>/g, "").replace(/<\/?(rb|rp|ruby)>/g, "");

export const wordId = (kana: string, kanji: string) => `${kana}|${stripRuby(kanji)}`;

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s:_/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "deck";
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const KANJI_RUN = /[\p{Script=Han}々〆ヵヶ]+$/u;

/**
 * Turns the engine's ruby markup into HTML where every reading sits over its own kanji.
 *
 * The markup (目<rt>め</rt>が悪<rt>わる</rt>い) annotates "everything since the last
 * reading", so wrapping a whole word in one <ruby> centers わる over が悪. Here each
 * reading gets its own <ruby> around just the kanji before it:
 *   <ruby>目<rt>め</rt></ruby>が<ruby>悪<rt>わる</rt></ruby>い
 * All text is escaped, so the result is safe for innerHTML.
 */
export function rubyHtml(markup: string): string {
  const src = markup.replace(/<\/?rb>|<rp>.*?<\/rp>|<\/?ruby>/g, "");
  let out = "";
  let last = 0;
  for (const m of src.matchAll(/<rt>(.*?)<\/rt>/g)) {
    const before = src.slice(last, m.index);
    // The reading belongs to the kanji right before it; any kana in front stays plain.
    const base = KANJI_RUN.exec(before)?.[0] || before;
    out += escapeHtml(before.slice(0, before.length - base.length));
    out += `<ruby>${escapeHtml(base)}<rp>(</rp><rt>${escapeHtml(m[1])}</rt><rp>)</rp></ruby>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(src.slice(last));
}

/** True when a ruby string contains nothing but text and <rt>/<rb> tags. */
export const isCleanRuby = (s: string) => /^(?:[^<>&]|<\/?(?:rt|rb)>)*$/.test(s);
