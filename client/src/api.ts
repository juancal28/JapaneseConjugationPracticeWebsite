import type { AnswerKey, DeckFile, DeckSource, DeckSummary, Word } from "@shared/types";
import type { ClassifyRequest, ImportPreview, ReviewResult } from "@shared/importTypes";

export interface DeckWithKey {
  deck: DeckFile;
  answerKey: AnswerKey;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `${res.status} ${res.statusText}`, body.details ?? []);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  listDecks: () => request<DeckSummary[]>("/api/decks"),
  getDeck: (slug: string) => request<DeckWithKey>(`/api/decks/${encodeURIComponent(slug)}`),
  createDeck: (name: string, words: Word[], source?: DeckSource) =>
    request<{ slug: string }>("/api/decks", json("POST", { name, words, source })),
  updateDeck: (slug: string, name: string, words: Word[]) =>
    request<{ slug: string }>(`/api/decks/${encodeURIComponent(slug)}`, json("PUT", { name, words })),
  deleteDeck: (slug: string) => request<void>(`/api/decks/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  importApkg: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportPreview>("/api/import", { method: "POST", body: form });
  },
  classify: (req: ClassifyRequest) => request<ReviewResult>("/api/classify", json("POST", req)),
};
