import { Router } from "express";
import type { DeckStore } from "../store/deckStore";

export function importRouter(_store: DeckStore): Router {
  return Router();
}
