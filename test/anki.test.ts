import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { zipSync } from "fflate";
import { zstdCompressSync } from "node:zlib";
import { parseApkg } from "../server/anki/parseApkg";
import { cleanExpression, cleanField, cleanReading, detectMapping } from "../server/anki/extract";

const NOTES: [number, string[], number][] = [
  [1001, ["食べる", "たべる", "to eat"], 11],
  [1002, ["<b>行く</b>", "いく", "to go&nbsp;"], 11],
  [1003, ["高い[sound:takai.mp3]", "たかい", "expensive, tall"], 12],
];

async function legacyApkg(): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE col (models TEXT, decks TEXT)");
  db.run("CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)");
  db.run("CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER)");
  const models = { "77": { name: "Japanese", flds: [{ name: "Reading", ord: 1 }, { name: "Expression", ord: 0 }, { name: "Meaning", ord: 2 }] } };
  const decks = { "1": { name: "Default" }, "10": { name: "Genki" }, "11": { name: "Genki::Lesson 1" }, "12": { name: "Genki::Lesson 2" } };
  db.run("INSERT INTO col VALUES (?, ?)", [JSON.stringify(models), JSON.stringify(decks)]);
  for (const [id, flds, did] of NOTES) {
    db.run("INSERT INTO notes VALUES (?, 77, ?)", [id, flds.join("\x1f")]);
    db.run("INSERT INTO cards VALUES (?, ?, ?)", [id + 5000, id, did]);
  }
  const bytes = db.export();
  db.close();
  return zipSync({ "collection.anki2": bytes, media: new TextEncoder().encode("{}") });
}

async function modernApkg(): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE notetypes (id INTEGER, name TEXT)");
  db.run("CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT)");
  db.run("CREATE TABLE decks (id INTEGER, name TEXT)");
  db.run("CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)");
  db.run("CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER)");
  db.run("INSERT INTO notetypes VALUES (77, 'Japanese')");
  ["Expression", "Reading", "Meaning"].forEach((f, i) => db.run("INSERT INTO fields VALUES (77, ?, ?)", [i, f]));
  db.run("INSERT INTO decks VALUES (10, 'Genki'), (11, 'Genki\x1fLesson 1'), (12, 'Genki\x1fLesson 2')");
  for (const [id, flds, did] of NOTES) {
    db.run("INSERT INTO notes VALUES (?, 77, ?)", [id, flds.join("\x1f")]);
    db.run("INSERT INTO cards VALUES (?, ?, ?)", [id + 5000, id, did]);
  }
  const bytes = db.export();
  db.close();
  // Newer exports also contain a stub collection.anki2 that must be ignored.
  const stub = new TextEncoder().encode("stub");
  return zipSync({ "collection.anki21b": new Uint8Array(zstdCompressSync(bytes)), "collection.anki2": stub });
}

describe("parseApkg", () => {
  it("reads a legacy (schema 11) package", async () => {
    const col = await parseApkg(await legacyApkg());
    expect(col.decks.map((d) => d.name)).toEqual(["Genki", "Genki::Lesson 1", "Genki::Lesson 2"]);
    expect(col.noteTypes).toEqual([{ id: "77", name: "Japanese", fields: ["Expression", "Reading", "Meaning"] }]);
    expect(col.notes).toHaveLength(3);
    expect(col.notes[1]).toEqual({ id: "1002", noteTypeId: "77", fields: ["<b>行く</b>", "いく", "to go&nbsp;"], deckIds: ["11"] });
  });

  it("reads a modern (schema 18, zstd) package", async () => {
    const col = await parseApkg(await modernApkg());
    expect(col.decks.map((d) => d.name)).toEqual(["Genki", "Genki::Lesson 1", "Genki::Lesson 2"]);
    expect(col.noteTypes[0].fields).toEqual(["Expression", "Reading", "Meaning"]);
    expect(col.notes.map((n) => n.deckIds[0])).toEqual(["11", "11", "12"]);
  });

  it("rejects non-zip files", async () => {
    await expect(parseApkg(new TextEncoder().encode("hello"))).rejects.toThrow(/Anki package/);
  });
});

describe("field cleaning", () => {
  it("strips HTML, sounds and entities", () => {
    expect(cleanField("<b>行く</b>&nbsp;[sound:iku.mp3]")).toBe("行く");
    expect(cleanField("to go<br>to move")).toBe("to go to move");
  });

  it("parses Anki furigana brackets", () => {
    expect(cleanExpression(" 食[た]べ 物[もの]")).toEqual({ surface: "食べ物", bracketReading: "たべもの", flags: [] });
    expect(cleanExpression("お 茶[ちゃ]")).toMatchObject({ surface: "お茶", bracketReading: "おちゃ" });
    expect(cleanExpression("勉強[べんきょう]する")).toMatchObject({ surface: "勉強する", bracketReading: "べんきょうする" });
  });

  it("strips 〜 and notes and keeps the first of several words", () => {
    expect(cleanExpression("〜行く (いく)").surface).toBe("行く");
    const multi = cleanExpression("高い、安い");
    expect(multi.surface).toBe("高い");
    expect(multi.flags).toHaveLength(1);
  });

  it("normalizes readings to hiragana", () => {
    expect(cleanReading("タベル")).toBe("たべる");
    expect(cleanReading("いく、ゆく")).toBe("いく");
  });
});

describe("detectMapping", () => {
  it("finds expression, reading and meaning by content", () => {
    const samples = [
      ["to eat", "食べる", "たべる"],
      ["to go", "行く", "いく"],
      ["expensive", "高い", "たかい"],
    ];
    expect(detectMapping(["Front", "Back", "Extra"], samples)).toEqual({ expression: 1, reading: 2, meaning: 0 });
  });
});
