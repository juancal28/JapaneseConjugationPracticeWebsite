import { unzipSync } from "fflate";
import initSqlJs, { type Database } from "sql.js";
import { zstdDecompressSync } from "node:zlib";

export interface ParsedNoteType {
  id: string;
  name: string;
  fields: string[];
}

export interface ParsedNote {
  id: string;
  noteTypeId: string;
  /** Raw field values (HTML), in field order. */
  fields: string[];
  deckIds: string[];
}

export interface ParsedCollection {
  decks: { id: string; name: string }[];
  noteTypes: ParsedNoteType[];
  notes: ParsedNote[];
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;
const getSql = () => (sqlPromise ??= initSqlJs());

/**
 * Reads an Anki .apkg (or .colpkg) export. Newer Anki versions store the collection
 * zstd-compressed as collection.anki21b (schema 18) and also include a stub
 * collection.anki2 that only says "please update Anki", so prefer anki21b > anki21 > anki2.
 * Media is ignored.
 */
export async function parseApkg(data: Uint8Array): Promise<ParsedCollection> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => f.name.startsWith("collection.anki2") });
  } catch {
    throw new Error("This doesn't look like an Anki package (.apkg is a zip file).");
  }
  let sqlite: Uint8Array;
  if (files["collection.anki21b"]) sqlite = new Uint8Array(zstdDecompressSync(files["collection.anki21b"]));
  else if (files["collection.anki21"]) sqlite = files["collection.anki21"];
  else if (files["collection.anki2"]) sqlite = files["collection.anki2"];
  else throw new Error("No Anki collection found inside the package.");

  const SQL = await getSql();
  const db = new SQL.Database(sqlite);
  try {
    return readCollection(db);
  } finally {
    db.close();
  }
}

function rows(db: Database, sql: string): unknown[][] {
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

function hasTable(db: Database, name: string) {
  return rows(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0;
}

function readCollection(db: Database): ParsedCollection {
  let decks: { id: string; name: string }[];
  let noteTypes: ParsedNoteType[];

  if (hasTable(db, "notetypes")) {
    // Schema 18: separate tables; deck names use \x1f between levels.
    decks = rows(db, "SELECT id, name FROM decks").map(([id, name]) => ({
      id: String(id),
      name: String(name).split("\x1f").join("::"),
    }));
    const fieldsByType = new Map<string, string[]>();
    for (const [ntid, , name] of rows(db, "SELECT ntid, ord, name FROM fields ORDER BY ntid, ord")) {
      const key = String(ntid);
      if (!fieldsByType.has(key)) fieldsByType.set(key, []);
      fieldsByType.get(key)!.push(String(name));
    }
    noteTypes = rows(db, "SELECT id, name FROM notetypes").map(([id, name]) => ({
      id: String(id),
      name: String(name),
      fields: fieldsByType.get(String(id)) ?? [],
    }));
  } else {
    // Schema 11: note types and decks are JSON blobs in the col table.
    const [[modelsJson, decksJson]] = rows(db, "SELECT models, decks FROM col") as [string, string][];
    const models = JSON.parse(modelsJson) as Record<string, { name: string; flds: { name: string; ord: number }[] }>;
    noteTypes = Object.entries(models).map(([id, m]) => ({
      id,
      name: m.name,
      fields: [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
    }));
    decks = Object.entries(JSON.parse(decksJson) as Record<string, { name: string }>).map(([id, d]) => ({ id, name: d.name }));
  }

  const deckIdsByNote = new Map<string, Set<string>>();
  for (const [nid, did] of rows(db, "SELECT nid, did FROM cards")) {
    const key = String(nid);
    if (!deckIdsByNote.has(key)) deckIdsByNote.set(key, new Set());
    deckIdsByNote.get(key)!.add(String(did));
  }
  const notes: ParsedNote[] = rows(db, "SELECT id, mid, flds FROM notes").map(([id, mid, flds]) => ({
    id: String(id),
    noteTypeId: String(mid),
    fields: String(flds).split("\x1f"),
    deckIds: [...(deckIdsByNote.get(String(id)) ?? [])],
  }));

  // Hide decks with no cards in them or their subdecks (e.g. the empty "Default" deck).
  const used = new Set(notes.flatMap((n) => n.deckIds));
  const usedNames = decks.filter((d) => used.has(d.id)).map((d) => d.name);
  decks = decks.filter((d) => usedNames.some((n) => n === d.name || n.startsWith(d.name + "::")));

  return { decks: decks.sort((a, b) => a.name.localeCompare(b.name)), noteTypes, notes };
}
