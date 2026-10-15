/**
 * Downloads JMdict (jmdict-simplified, English) and builds a compact lookup index of
 * the entries the importer cares about: verbs, い/な adjectives, and する-nouns.
 * Output: data/jmdict/index.json (gitignored). Run once per machine: npm run setup:jmdict
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { isRelevantPos, type JmdictIndex } from "../server/classify/jmdict";

// Pinned so every machine builds the same index. Bump deliberately.
const RELEASE = "3.6.2+20261012204142";
const URL = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(RELEASE)}/jmdict-eng-${encodeURIComponent(RELEASE)}.json.zip`;
const OUT = path.resolve("data/jmdict/index.json");

interface JmWord {
  kanji: { text: string; common: boolean }[];
  kana: { text: string; common: boolean }[];
  sense: { partOfSpeech: string[]; gloss: { text: string }[] }[];
}

console.log(`Downloading JMdict ${RELEASE}...`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
const jsonName = Object.keys(zip).find((n) => n.endsWith(".json"));
if (!jsonName) throw new Error("No JSON file in the JMdict archive");
const words: JmWord[] = JSON.parse(strFromU8(zip[jsonName])).words;
console.log(`Parsed ${words.length} entries; building index...`);

const index: JmdictIndex = { version: RELEASE, entries: [], bySurface: {} };
for (const w of words) {
  const pos = [...new Set(w.sense.flatMap((s) => s.partOfSpeech))];
  if (!pos.some(isRelevantPos)) continue;
  const id = index.entries.length;
  index.entries.push({
    k: w.kanji.map((k) => k.text),
    r: w.kana.map((k) => k.text),
    p: pos,
    g: w.sense
      .slice(0, 2)
      .map((s) => s.gloss.slice(0, 3).map((g) => g.text).join(", "))
      .join("; "),
    c: w.kanji.some((k) => k.common) || w.kana.some((k) => k.common),
  });
  for (const surface of new Set([...w.kanji.map((k) => k.text), ...w.kana.map((k) => k.text)])) {
    (index.bySurface[surface] ??= []).push(id);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`Wrote ${index.entries.length} entries to ${path.relative(process.cwd(), OUT)}`);
