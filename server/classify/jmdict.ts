import fs from "node:fs";
import path from "node:path";
import type { JmdictCandidate, ReviewType } from "../../shared/importTypes";
import type { WordException } from "../../shared/types";

export interface JmdictEntry {
  /** kanji forms */
  k: string[];
  /** readings */
  r: string[];
  /** parts of speech (JMdict entity codes, e.g. v5k, v1, adj-i, vs) */
  p: string[];
  /** first glosses */
  g: string;
  /** common word */
  c: boolean;
}

export interface JmdictIndex {
  version: string;
  entries: JmdictEntry[];
  bySurface: Record<string, number[]>;
}

const RELEVANT = /^(v1|v1-s|v5.*|vk|vs|vs-i|vs-s|vz|adj-i|adj-ix|adj-na)$/;
export const isRelevantPos = (pos: string) => RELEVANT.test(pos);

export const INDEX_PATH = path.resolve("data/jmdict/index.json");
let cached: JmdictIndex | null | undefined;

/** Loads the index built by `npm run setup:jmdict`, or null if it hasn't been built. */
export function loadJmdict(): JmdictIndex | null {
  if (cached !== undefined) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as JmdictIndex;
  } catch {
    cached = null;
  }
  return cached;
}

const toCandidate = (e: JmdictEntry): JmdictCandidate => ({ kanji: e.k, kana: e.r, pos: e.p, gloss: e.g });

export function lookup(index: JmdictIndex, surface: string, reading: string): JmdictEntry[] {
  const bySurface = (s: string) => (index.bySurface[s] ?? []).map((i) => index.entries[i]);
  let found = bySurface(surface);
  if (reading && found.length > 1) {
    const withReading = found.filter((e) => e.r.includes(reading));
    if (withReading.length) found = withReading;
  }
  if (!found.length && reading && reading !== surface) {
    found = bySurface(reading).filter((e) => e.k.length === 0 || e.k.includes(surface) || !surface);
  }
  // Common words first.
  return [...found].sort((a, b) => Number(b.c) - Number(a.c));
}

export interface Suggestion {
  type: ReviewType;
  exception: WordException;
  /** True when the card is a する-noun written without する (e.g. 勉強). */
  suruNoun: boolean;
}

/** Maps JMdict parts of speech to the engine's word type. */
export function suggestFromPos(pos: string[], surface: string): Suggestion {
  const has = (p: string) => pos.includes(p);
  const s = (type: ReviewType, exception: WordException = null, suruNoun = false): Suggestion => ({ type, exception, suruNoun });
  if (has("v5k-s")) return s("u", "iku");
  if (has("v5r-i")) return s("u", "aru");
  if (has("v5aru")) return s("u", "honorific");
  if (pos.some((p) => /^v5/.test(p))) return s("u");
  if (has("v1-s")) return s("ru", "kureru");
  if (has("v1")) return s("ru");
  if (has("vk")) return s("irr");
  if (has("vs-i") || has("vs-s")) return s("irr");
  if (has("vs") && /(する|為る)$/.test(surface)) return s("irr");
  if (has("adj-ix")) return s("i", "ii");
  if (has("adj-i")) return s("i");
  if (has("adj-na")) return s("na");
  if (has("vs")) return s("skip", null, true);
  return s("skip");
}

export interface JmdictResult {
  candidates: JmdictCandidate[];
  suggestion: Suggestion | null;
}

/**
 * Looks a card's word up. Handles する-verbs written with する (勉強する), which JMdict
 * lists as the bare noun (勉強, pos "vs").
 */
export function classifyWithJmdict(index: JmdictIndex, surface: string, reading: string): JmdictResult {
  let entries = lookup(index, surface, reading);
  let suruSuffix = false;
  if (!entries.length && /(する)$/.test(surface)) {
    entries = lookup(index, surface.slice(0, -2), reading.endsWith("する") ? reading.slice(0, -2) : reading).filter((e) =>
      e.p.includes("vs"),
    );
    suruSuffix = entries.length > 0;
  }
  if (!entries.length) return { candidates: [], suggestion: null };
  const best = entries[0];
  const suggestion = suruSuffix ? { type: "irr" as const, exception: null, suruNoun: false } : suggestFromPos(best.p, surface);
  return { candidates: entries.slice(0, 5).map(toCandidate), suggestion };
}
