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
