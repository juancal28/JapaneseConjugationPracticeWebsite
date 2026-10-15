import { Router } from "express";
import { slugify } from "../../shared/ids";
import type { DeckFile } from "../../shared/types";
import type { DeckStore } from "../store/deckStore";
import { validateWords } from "../../shared/validate";

export function decksRouter(store: DeckStore): Router {
  const r = Router();

  r.get("/", async (_req, res) => {
    res.json(await store.list());
  });

  r.get("/:slug", async (req, res) => {
    const found = await store.get(req.params.slug);
    if (!found) return void res.status(404).json({ error: "Deck not found" });
    res.json(found);
  });

  // Create a deck from reviewed words. Body: { name, source?, words }
  r.post("/", async (req, res) => {
    const { name, source, words } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return void res.status(400).json({ error: "Deck name is required" });
    const errors = validateWords(words);
    if (errors.length) return void res.status(400).json({ error: "Some words are invalid", details: errors });

    let slug = slugify(name);
    for (let n = 2; await store.exists(slug); n++) slug = `${slugify(name)}-${n}`;
    const deck: DeckFile = { name: name.trim(), slug, builtin: false, source, words };
    await store.save(deck);
    res.status(201).json({ slug });
  });

  // Replace a deck's name/words (edit after import).
  r.put("/:slug", async (req, res) => {
    const found = await store.get(req.params.slug);
    if (!found) return void res.status(404).json({ error: "Deck not found" });
    const { name, words } = req.body ?? {};
    const errors = validateWords(words);
    if (errors.length) return void res.status(400).json({ error: "Some words are invalid", details: errors });
    await store.save({ ...found.deck, name: typeof name === "string" && name.trim() ? name.trim() : found.deck.name, words });
    res.json({ slug: found.deck.slug });
  });

  r.delete("/:slug", async (req, res) => {
    const found = await store.get(req.params.slug);
    if (!found) return void res.status(404).json({ error: "Deck not found" });
    if (found.deck.builtin) return void res.status(400).json({ error: "Built-in decks can't be deleted" });
    await store.remove(req.params.slug);
    res.status(204).end();
  });

  return r;
}
