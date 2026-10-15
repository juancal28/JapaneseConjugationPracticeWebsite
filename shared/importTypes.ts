import type { WordException, WordType } from "./types";

/** One Anki deck (or subdeck) inside the uploaded .apkg. */
export interface AnkiDeckInfo {
  id: string;
  /** Full name with "::" separators, e.g. "Genki::Lesson 3". */
  name: string;
  /** Notes whose cards are in this deck itself (not counting subdecks). */
  noteCount: number;
  /** Notes in this deck or any of its subdecks, each counted once. */
  totalNoteCount: number;
}

export interface NoteTypeInfo {
  id: string;
  name: string;
  fields: string[];
  noteCount: number;
  /** Auto-detected field indexes; null when no field fits. */
  mapping: FieldMapping;
  /** First few notes' cleaned field values, to help the user check the mapping. */
  samples: string[][];
}

export interface FieldMapping {
  expression: number | null;
  reading: number | null;
  meaning: number | null;
}

export interface ImportPreview {
  importId: string;
  fileName: string;
  decks: AnkiDeckInfo[];
  noteTypes: NoteTypeInfo[];
}

export interface ClassifyRequest {
  importId: string;
  /** Anki deck ids to include (subdecks are not added automatically). */
  deckIds: string[];
  /** noteTypeId -> mapping */
  mappings: Record<string, FieldMapping>;
}

export type ReviewType = WordType | "skip";

export interface JmdictCandidate {
  kanji: string[];
  kana: string[];
  pos: string[];
  gloss: string;
}

export interface ReviewRow {
  /** Stable id for the row within this import (the Anki note id). */
  rowId: string;
  include: boolean;
  kana: string;
  /** Plain kanji surface (no ruby), e.g. 食べる. The server builds the ruby markup on save. */
  kanjiSurface: string;
  /** Ruby markup built from kanjiSurface + kana. */
  kanji: string;
  eng: string;
  type: ReviewType;
  exception: WordException;
  /** Original field values as cleaned text, for reference. */
  raw: { expression: string; reading: string; meaning: string };
  jmdict: { candidates: JmdictCandidate[]; suggestedType: ReviewType | null };
  claude: { type: ReviewType; confidence: "high" | "medium" | "low"; note: string } | null;
  /** Why this row needs attention (empty when it looks fine). */
  flags: string[];
}

export interface ReviewResult {
  rows: ReviewRow[];
  /** Default deck name (the selected Anki deck's last name segment). */
  suggestedName: string;
  source: { file: string; ankiDeck: string };
  claudeStatus: "ok" | "skipped-no-key" | "failed";
  claudeError?: string;
  jmdictStatus: "ok" | "missing";
}
