import fs from "node:fs";
import path from "node:path";

/**
 * Helpers for reading the original site's word lists and modules out of `.reference/`
 * (gitignored). Fetch them with `npm run fixture:reference -- --fetch` first.
 */

export const REF_DIR = path.resolve(".reference");
const BASE = "https://steven-kraft.com";
export const CHUNKS = {
  verb: "component---src-components-layouts-verb-conjugation-js-3716b36a22380d46d4d6.js",
  adj: "component---src-components-layouts-adj-conjugation-js-b99853e7c3a54a9a988b.js",
};

export interface RefWord {
  kana: string;
  kanji: string;
  type: string;
  eng: string;
}

export async function fetchReference(): Promise<void> {
  fs.mkdirSync(REF_DIR, { recursive: true });
  for (const chunk of Object.values(CHUNKS)) {
    for (const file of [chunk, chunk + ".map"]) {
      const dest = path.join(REF_DIR, file);
      if (fs.existsSync(dest)) continue;
      const res = await fetch(`${BASE}/${file}`);
      if (!res.ok) throw new Error(`GET ${file}: ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
  }
}

/** The word list is embedded in the chunk as JSON.parse('[...]'). */
export function readWordList(kind: keyof typeof CHUNKS): RefWord[] {
  const js = fs.readFileSync(path.join(REF_DIR, CHUNKS[kind]), "utf8");
  const m = /JSON\.parse\('(\[.*?\])'\)/s.exec(js);
  if (!m) throw new Error(`No word list in ${CHUNKS[kind]}`);
  // The literal is a single-quoted JS string; undo its escapes.
  const literal = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  return JSON.parse(literal);
}

/** Writes the original form modules from the source map to .reference/esm/<name>.mjs. */
export function extractModules(kind: keyof typeof CHUNKS): Record<string, string> {
  const map = JSON.parse(fs.readFileSync(path.join(REF_DIR, CHUNKS[kind] + ".map"), "utf8"));
  const outDir = path.join(REF_DIR, "esm", kind);
  fs.mkdirSync(outDir, { recursive: true });
  const files: Record<string, string> = {};
  map.sources.forEach((src: string, i: number) => {
    const m = /japanese\/(verbs|adjectives)\/([\w-]+)\.js$/.exec(src);
    if (!m || !map.sourcesContent?.[i]) return;
    const out = path.join(outDir, m[2] + ".mjs");
    fs.writeFileSync(out, map.sourcesContent[i]);
    files[m[2]] = out;
  });
  return files;
}
