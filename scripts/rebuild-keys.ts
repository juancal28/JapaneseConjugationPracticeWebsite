/** Regenerates answer-key.json for every deck. Run after changing the conjugation engine. */
import { FsDeckStore } from "../server/store/deckStore";

const store = new FsDeckStore();
for (const summary of await store.list()) {
  const found = await store.get(summary.slug);
  if (!found) continue;
  await store.save(found.deck);
  console.log(`${summary.slug}: ${summary.wordCount} words`);
}
