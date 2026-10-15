import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { parseApkg, type ParsedCollection } from "../anki/parseApkg";
import { cleanField, detectMapping } from "../anki/extract";
import { classifyImport } from "../classify/pipeline";
import type { ClassifyRequest, ImportPreview } from "../../shared/importTypes";
import type { DeckStore } from "../store/deckStore";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

/** Parsed uploads, kept in memory between the upload and classify steps. */
const imports = new Map<string, { fileName: string; col: ParsedCollection; expires: number }>();
const TTL_MS = 60 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, entry] of imports) if (entry.expires < now) imports.delete(id);
}

export function importRouter(_store: DeckStore): Router {
  const r = Router();

  r.post("/import", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) return void res.status(400).json({ error: "No file uploaded" });
      const col = await parseApkg(new Uint8Array(req.file.buffer));
      sweep();
      const importId = randomUUID();
      // multer decodes the filename as latin1; Anki deck names are often Japanese.
      const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
      imports.set(importId, { fileName, col, expires: Date.now() + TTL_MS });

      const preview: ImportPreview = {
        importId,
        fileName,
        decks: col.decks.map((d) => {
          const subtree = new Set(col.decks.filter((x) => x.name === d.name || x.name.startsWith(d.name + "::")).map((x) => x.id));
          return {
            id: d.id,
            name: d.name,
            noteCount: col.notes.filter((n) => n.deckIds.includes(d.id)).length,
            totalNoteCount: col.notes.filter((n) => n.deckIds.some((id) => subtree.has(id))).length,
          };
        }),
        noteTypes: col.noteTypes
          .map((nt) => {
            const notes = col.notes.filter((n) => n.noteTypeId === nt.id);
            const cleaned = notes.slice(0, 30).map((n) => n.fields.map(cleanField));
            return {
              id: nt.id,
              name: nt.name,
              fields: nt.fields,
              noteCount: notes.length,
              mapping: detectMapping(nt.fields, cleaned),
              samples: cleaned.slice(0, 3),
            };
          })
          .filter((nt) => nt.noteCount > 0),
      };
      res.json(preview);
    } catch (e) {
      if (e instanceof Error && /Anki|collection/.test(e.message)) return void res.status(400).json({ error: e.message });
      next(e);
    }
  });

  r.post("/classify", async (req, res, next) => {
    try {
      const body = req.body as ClassifyRequest;
      const entry = imports.get(body?.importId);
      if (!entry) return void res.status(404).json({ error: "Upload expired; please upload the deck again." });
      if (!Array.isArray(body.deckIds) || body.deckIds.length === 0) return void res.status(400).json({ error: "Pick at least one deck" });
      res.json(await classifyImport(entry.col, entry.fileName, body));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
