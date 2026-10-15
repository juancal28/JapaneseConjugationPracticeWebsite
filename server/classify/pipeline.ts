import { cleanExpression, cleanField, cleanReading } from "../anki/extract";
import type { ParsedCollection } from "../anki/parseApkg";
import { alignRuby, kataToHira } from "../../shared/ruby";
import { wordId } from "../../shared/ids";
import type { ClassifyRequest, ReviewResult, ReviewRow } from "../../shared/importTypes";
import { WORD_EXCEPTIONS, type WordException } from "../../shared/types";
import { classifyWithJmdict, loadJmdict } from "./jmdict";
import { ClaudeUnavailableError, reviewWithClaude, type ReviewInput } from "./claudeReview";
import { rowProblem } from "../../shared/reviewRows";

const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const HAS_JP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

/** Extract -> JMdict -> Claude review -> rows for the review table. */
export async function classifyImport(col: ParsedCollection, fileName: string, req: ClassifyRequest): Promise<ReviewResult> {
  const wanted = new Set(req.deckIds);
  const noteTypes = new Map(col.noteTypes.map((nt) => [nt.id, nt]));
  const jmdict = loadJmdict();
  const rows: ReviewRow[] = [];

  for (const note of col.notes) {
    if (!note.deckIds.some((d) => wanted.has(d))) continue;
    const mapping = req.mappings[note.noteTypeId];
    if (!mapping || mapping.expression == null || !noteTypes.has(note.noteTypeId)) continue;
    const field = (i: number | null) => (i == null ? "" : cleanField(note.fields[i] ?? ""));

    const expr = cleanExpression(field(mapping.expression));
    if (!expr.surface || !HAS_JP.test(expr.surface)) continue;
    const flags = [...expr.flags];
    let reading = mapping.reading != null ? cleanReading(field(mapping.reading)) : "";
    if (!reading) reading = expr.bracketReading || (KANA_ONLY.test(expr.surface) ? kataToHira(expr.surface) : "");
    const meaning = field(mapping.meaning);

    const jm = jmdict ? classifyWithJmdict(jmdict, expr.surface, reading) : { candidates: [], suggestion: null };
    if (jm.normalized) {
      expr.surface = jm.normalized.surface;
      reading = jm.normalized.reading;
    }
    if (!reading && jm.candidates[0]) reading = jm.candidates[0].kana[0] ?? "";
    if (jm.suggestion?.suruNoun) flags.push("する-noun without する: add する to practice it as a verb");

    const type = jm.suggestion?.type ?? "skip";
    rows.push({
      rowId: note.id,
      include: type !== "skip",
      kana: reading,
      kanjiSurface: expr.surface,
      kanji: "",
      eng: meaning,
      type,
      exception: jm.suggestion?.exception ?? null,
      raw: { expression: expr.surface, reading, meaning },
      jmdict: { candidates: jm.candidates, suggestedType: jm.suggestion?.type ?? null },
      claude: null,
      flags,
    });
  }

  let claudeStatus: ReviewResult["claudeStatus"] = "ok";
  let claudeError: string | undefined;
  if (rows.length) {
    try {
      const inputs: ReviewInput[] = rows.map((r) => ({
        id: r.rowId,
        expression: r.raw.expression,
        reading: r.raw.reading,
        meaning: r.raw.meaning,
        jmdict: r.jmdict.candidates.slice(0, 3),
        jmdictSuggestion: r.jmdict.suggestedType,
      }));
      const reviewed = await reviewWithClaude(inputs);
      for (const row of rows) {
        const c = reviewed.get(row.rowId);
        if (!c) {
          row.flags.push("Claude didn't return this card");
          continue;
        }
        row.claude = { type: c.type, confidence: c.confidence, note: c.note };
        row.type = c.type;
        row.include = c.include && c.type !== "skip";
        if (c.kana) row.kana = kataToHira(c.kana);
        if (c.kanjiSurface) row.kanjiSurface = c.kanjiSurface;
        if (c.eng) row.eng = c.eng;
        const ex = c.exception === "none" ? null : (c.exception as WordException);
        row.exception = ex && WORD_EXCEPTIONS.includes(ex) ? ex : null;
        if (row.jmdict.suggestedType && row.jmdict.suggestedType !== c.type) row.flags.push("Claude and JMdict disagree");
        if (c.confidence === "low") row.flags.push("Claude is unsure");
      }
    } catch (e) {
      if (e instanceof ClaudeUnavailableError) claudeStatus = "skipped-no-key";
      else {
        claudeStatus = "failed";
        claudeError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const seen = new Set<string>();
  for (const row of rows) {
    const ruby = alignRuby(row.kanjiSurface, row.kana);
    row.kanji = ruby.ruby;
    if (!ruby.aligned) row.flags.push("Couldn't line up the furigana; check the kanji/reading");
    const id = wordId(row.kana, row.kanji);
    if (row.include && seen.has(id)) {
      row.include = false;
      row.flags.push("Duplicate of an earlier card");
    }
    if (row.include) seen.add(id);
    const problem = rowProblem(row);
    if (problem) row.flags.push(problem);
  }

  const selected = col.decks.filter((d) => wanted.has(d.id)).map((d) => d.name);
  const ankiDeck = selected.length === 1 ? selected[0] : commonPrefix(selected) || fileName.replace(/\.(apkg|colpkg)$/i, "");
  return {
    rows,
    suggestedName: ankiDeck.split("::").pop() || ankiDeck,
    source: { file: fileName, ankiDeck },
    claudeStatus,
    claudeError,
    jmdictStatus: jmdict ? "ok" : "missing",
  };
}

function commonPrefix(names: string[]): string {
  if (!names.length) return "";
  const parts = names.map((n) => n.split("::"));
  const out: string[] = [];
  for (let i = 0; parts.every((p) => p[i] !== undefined && p[i] === parts[0][i]); i++) out.push(parts[0][i]);
  return out.join("::");
}
