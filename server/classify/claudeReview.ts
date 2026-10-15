import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { JmdictCandidate } from "../../shared/importTypes";

export interface ReviewInput {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  jmdict: JmdictCandidate[];
  jmdictSuggestion: string | null;
}

const ReviewItem = z.object({
  id: z.string(),
  include: z.boolean().describe("false for nouns, phrases, particles, adverbs and anything else that isn't a conjugatable verb or adjective"),
  kana: z.string().describe("dictionary-form reading in hiragana, e.g. たべる"),
  kanjiSurface: z.string().describe("dictionary form as normally written, e.g. 食べる; same as kana if written in kana"),
  eng: z.string().describe("short English meaning, e.g. 'to eat'"),
  type: z.enum(["u", "ru", "irr", "i", "na", "skip"]),
  exception: z.enum(["none", "iku", "aru", "honorific", "kureru", "ii"]),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().describe("one short sentence; empty if nothing notable"),
});
const ReviewOutput = z.object({ items: z.array(ReviewItem) });
export type ReviewItem = z.infer<typeof ReviewItem>;

const SYSTEM = `You check Japanese vocabulary cards imported from Anki before they're used in a conjugation drill.

For each card you get the cleaned expression, reading and meaning fields, plus the JMdict dictionary matches (parts of speech use JMdict codes) and the type JMdict suggests. Decide what the drill should practice.

Types:
- "u": godan verb (書く, 話す, 帰る, 行く)
- "ru": ichidan verb (食べる, 見る, 起きる)
- "irr": する-verb or 来る-verb, written WITH する/来る/くる (する, 勉強する, 来る, 持ってくる)
- "i": い-adjective (高い, いい, かっこいい)
- "na": な-adjective (きれい, 元気, 好き, 有名)
- "skip": anything else: nouns, set phrases, expressions, adverbs, counters, particles, ずる-verbs, cards that aren't a single word.

Exceptions (otherwise "none"): "iku" for 行く and compounds ending in 行く (持って行く); "aru" for ある; "honorific" for くださる, いらっしゃる, おっしゃる, なさる, ござる; "kureru" for くれる; "ii" for いい and adjectives ending in いい (かっこいい).

Rules:
- Return the word in DICTIONARY FORM. If a card shows a conjugated form (食べます, 高くない), convert it and say so in the note.
- A する-noun card without する (勉強, 電話) is "skip" with include=false, and the note says it can be practiced by adding する. A card written with する (勉強する) is "irr".
- Words like 好き, 嫌い, きれい, 有名 are "na" even though some end in い.
- Prefer the JMdict suggestion unless the card clearly means a different word or JMdict is wrong for this card. When you disagree with JMdict, explain why in the note.
- kana must be hiragana only. kanjiSurface must be the normal written form with no brackets or furigana.
- confidence is "low" if the card is ambiguous or you had to guess.
- Return exactly one item per input card, with the same id.`;

export class ClaudeUnavailableError extends Error {}

/** Reviews cards with Claude in batches. Throws ClaudeUnavailableError when no API key is configured. */
export async function reviewWithClaude(cards: ReviewInput[], batchSize = 60): Promise<Map<string, ReviewItem>> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ClaudeUnavailableError("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic();
  const batches: ReviewInput[][] = [];
  for (let i = 0; i < cards.length; i += batchSize) batches.push(cards.slice(i, i + batchSize));

  const results = await Promise.all(batches.map((batch) => reviewBatch(client, batch)));
  const byId = new Map<string, ReviewItem>();
  for (const items of results) for (const item of items) byId.set(item.id, item);
  return byId;
}

async function reviewBatch(client: Anthropic, batch: ReviewInput[]): Promise<ReviewItem[]> {
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Retry on a fallback model if the request is declined for policy reasons.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReviewOutput) },
    system: SYSTEM,
    messages: [{ role: "user", content: "Cards (JSON):\n" + JSON.stringify(batch, null, 1) }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to review this batch (${response.stop_details?.category ?? "unknown reason"}).`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Claude's review was cut off (max_tokens); try a smaller deck.");
  if (!response.parsed_output) throw new Error("Claude returned no parseable review.");
  return response.parsed_output.items;
}
