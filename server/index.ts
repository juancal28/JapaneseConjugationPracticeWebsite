import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { decksRouter } from "./routes/decks";
import { importRouter } from "./routes/import";
import { FsDeckStore } from "./store/deckStore";

const app = express();
const store = new FsDeckStore();

app.use(express.json({ limit: "10mb" }));
app.use("/api/decks", decksRouter(store));
app.use("/api", importRouter(store));

// In production, serve the built client and let React Router handle page routes.
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
