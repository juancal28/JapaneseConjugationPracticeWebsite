import fs from "node:fs/promises";
import path from "node:path";
import { buildAnswerKey } from "../../shared/conjugation/answerKey";
import { isAdjType, isVerbType, type AnswerKey, type DeckFile, type DeckSummary } from "../../shared/types";

/**
 * Where decks live. The filesystem store writes into the repo's decks/ folder so
 * that decks and answer keys are tracked by git. On a host with an ephemeral disk
 * (Railway), swap in another implementation.
 */
export interface DeckStore {
  list(): Promise<DeckSummary[]>;
  get(slug: string): Promise<{ deck: DeckFile; answerKey: AnswerKey } | null>;
  /** Writes words.json and a freshly generated answer-key.json. */
  save(deck: DeckFile): Promise<void>;
  remove(slug: string): Promise<void>;
  exists(slug: string): Promise<boolean>;
}

const SLUG_RE = /^[\p{L}\p{N}-]+$/u;

export class FsDeckStore implements DeckStore {
  constructor(private root = path.resolve("decks")) {}

  private dir(slug: string) {
    if (!SLUG_RE.test(slug)) throw new Error(`Invalid deck slug: ${slug}`);
    return path.join(this.root, slug);
  }

  async list(): Promise<DeckSummary[]> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.root);
    } catch {
      return [];
    }
    const out: DeckSummary[] = [];
    for (const slug of entries) {
      if (!SLUG_RE.test(slug)) continue;
      try {
        const deck: DeckFile = JSON.parse(await fs.readFile(path.join(this.root, slug, "words.json"), "utf8"));
        out.push({
          name: deck.name,
          slug: deck.slug,
          builtin: deck.builtin,
          wordCount: deck.words.length,
          verbCount: deck.words.filter((w) => isVerbType(w.type)).length,
          adjCount: deck.words.filter((w) => isAdjType(w.type)).length,
        });
      } catch {
        // Not a deck folder.
      }
    }
    // Built-ins first, then alphabetical.
    return out.sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.name.localeCompare(b.name));
  }

  async get(slug: string) {
    try {
      const dir = this.dir(slug);
      const deck: DeckFile = JSON.parse(await fs.readFile(path.join(dir, "words.json"), "utf8"));
      const answerKey: AnswerKey = JSON.parse(await fs.readFile(path.join(dir, "answer-key.json"), "utf8"));
      return { deck, answerKey };
    } catch {
      return null;
    }
  }

  async exists(slug: string) {
    try {
      await fs.access(path.join(this.dir(slug), "words.json"));
      return true;
    } catch {
      return false;
    }
  }

  async save(deck: DeckFile) {
    const dir = this.dir(deck.slug);
    await fs.mkdir(dir, { recursive: true });
    await writeJson(path.join(dir, "words.json"), deck);
    await writeJson(path.join(dir, "answer-key.json"), buildAnswerKey(deck.words));
  }

  async remove(slug: string) {
    await fs.rm(this.dir(slug), { recursive: true, force: true });
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}
