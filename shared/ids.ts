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

const ALLOWED_TAG = /&lt;(\/?)(ruby|rt|rb|rp)&gt;/g;

/** Escapes HTML, then re-allows only the ruby tags the engine produces. Safe to pass to innerHTML. */
export function safeRubyHtml(s: string): string {
  const escaped = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return escaped.replace(ALLOWED_TAG, "<$1$2>");
}

/** True when a ruby string contains nothing but text and <rt>/<rb> tags. */
export const isCleanRuby = (s: string) => /^(?:[^<>&]|<\/?(?:rt|rb)>)*$/.test(s);
