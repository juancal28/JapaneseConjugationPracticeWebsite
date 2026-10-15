/**
 * Builds decks/builtin-verbs and decks/builtin-adjectives from the original site's
 * word lists (90 verbs, 122 adjectives). Run once; the output is committed.
 */
import { wordId } from "../shared/ids";
import type { DeckFile, Word, WordException, WordType } from "../shared/types";
import { FsDeckStore } from "../server/store/deckStore";
import { fetchReference, readWordList, type RefWord } from "./reference-data";

const EXCEPTIONS: Record<string, WordException> = {
  いく: "iku",
  もっていく: "iku",
  ある: "aru",
  いい: "ii",
};

function toWords(list: RefWord[]): Word[] {
  const seen = new Set<string>();
  const words: Word[] = [];
  for (const w of list) {
    const id = wordId(w.kana, w.kanji);
    if (seen.has(id)) continue;
    seen.add(id);
    words.push({
      id,
      kana: w.kana,
      kanji: w.kanji,
      eng: w.eng ?? "",
      type: w.type as WordType,
      exception: EXCEPTIONS[w.kana] ?? null,
    });
  }
  return words;
}

await fetchReference();
const store = new FsDeckStore();
const decks: DeckFile[] = [
  { name: "Built-in Verbs", slug: "builtin-verbs", builtin: true, words: toWords(readWordList("verb")) },
  { name: "Built-in Adjectives", slug: "builtin-adjectives", builtin: true, words: toWords(readWordList("adj")) },
];
for (const deck of decks) {
  await store.save(deck);
  console.log(`${deck.slug}: ${deck.words.length} words`);
}
