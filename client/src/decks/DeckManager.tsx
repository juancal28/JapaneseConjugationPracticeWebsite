import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { DeckSummary } from "@shared/types";
import type { ImportPreview, ReviewResult, ReviewRow } from "@shared/importTypes";
import { wordToRow } from "@shared/reviewRows";
import { api } from "../api";
import { BackButton, DarkModeButton } from "../practice/components";
import ImportSetup from "./ImportSetup";
import ReviewTable from "./ReviewTable";
import "../styles/decks.css";

type View =
  | { kind: "list" }
  | { kind: "setup"; preview: ImportPreview }
  | { kind: "review"; result: ReviewResult }
  | { kind: "edit"; slug: string; name: string; rows: ReviewRow[] };

export default function DeckManager() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = () => api.listDecks().then(setDecks, (e) => setMessage({ kind: "error", text: String(e) }));
  useEffect(() => {
    refresh();
    document.title = "Decks";
  }, []);

  const done = (text: string) => {
    setMessage({ kind: "ok", text });
    setView({ kind: "list" });
    refresh();
  };

  return (
    <div className="dm">
      <BackButton to="/" />
      <h1>Decks</h1>
      <p className="dm-sub">
        Upload an Anki deck, check how its words were classified, then practice it from the <Link to="/">practice page</Link>.
      </p>
      {message && <div className={"dm-banner " + message.kind}>{message.text}</div>}

      {view.kind === "list" && (
        <>
          <Upload
            onPreview={(preview) => {
              setMessage(null);
              setView({ kind: "setup", preview });
            }}
            onError={(text) => setMessage({ kind: "error", text })}
          />
          <DeckList
            decks={decks}
            onEdit={async (d) => {
              const { deck } = await api.getDeck(d.slug);
              setMessage(null);
              setView({ kind: "edit", slug: d.slug, name: deck.name, rows: deck.words.map(wordToRow) });
            }}
            onDeleted={(d) => done(`Deleted "${d.name}". Commit the removal of decks/${d.slug}/ to sync it.`)}
            onError={(text) => setMessage({ kind: "error", text })}
          />
        </>
      )}

      {view.kind === "setup" && (
        <ImportSetup preview={view.preview} onCancel={() => setView({ kind: "list" })} onClassified={(result) => setView({ kind: "review", result })} />
      )}

      {view.kind === "review" && (
        <ReviewTable
          initialName={view.result.suggestedName}
          initialRows={view.result.rows}
          status={view.result}
          onCancel={() => setView({ kind: "list" })}
          onSave={async (name, words) => {
            const { slug } = await api.createDeck(name, words, { ...view.result.source, importedAt: new Date().toISOString() });
            done(`Saved "${name}" (${words.length} words). Commit decks/${slug}/ to sync it to your other computers.`);
          }}
        />
      )}

      {view.kind === "edit" && (
        <ReviewTable
          initialName={view.name}
          initialRows={view.rows}
          onCancel={() => setView({ kind: "list" })}
          onSave={async (name, words) => {
            await api.updateDeck(view.slug, name, words);
            done(`Updated "${name}". Commit decks/${view.slug}/ to sync the changes.`);
          }}
        />
      )}

      <div className="qm-buttons" style={{ position: "fixed" }}>
        <DarkModeButton />
      </div>
    </div>
  );
}

function Upload({ onPreview, onError }: { onPreview: (p: ImportPreview) => void; onError: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(apkg|colpkg)$/i.test(file.name)) return onError("Please choose an Anki export (.apkg).");
    setBusy(true);
    try {
      onPreview(await api.importApkg(file));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section>
      <h2>Upload an Anki deck</h2>
      <div
        className={"dm-drop" + (over ? " over" : "")}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files[0]);
        }}
      >
        {busy ? (
          <>
            <span className="dm-spinner" />
            Reading deck…
          </>
        ) : (
          <>Drop an .apkg file here, or click to choose one. (In Anki: File → Export → "Anki Deck Package")</>
        )}
      </div>
      <input ref={input} type="file" accept=".apkg,.colpkg" hidden onChange={(e) => send(e.target.files?.[0])} />
    </section>
  );
}

function DeckList(props: {
  decks: DeckSummary[];
  onEdit: (d: DeckSummary) => void;
  onDeleted: (d: DeckSummary) => void;
  onError: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <section>
      <h2>Your decks</h2>
      <table className="dm-table">
        <thead>
          <tr>
            <th>Deck</th>
            <th>Words</th>
            <th>Verbs</th>
            <th>Adjectives</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.decks.map((d) => (
            <tr key={d.slug}>
              <td>
                {d.name}
                <div className="dm-muted">decks/{d.slug}/</div>
              </td>
              <td className="num">{d.wordCount}</td>
              <td className="num">{d.verbCount}</td>
              <td className="num">{d.adjCount}</td>
              <td>
                {!d.builtin && (
                  <div className="dm-actions">
                    <button className="dm-btn" onClick={() => props.onEdit(d)}>
                      Edit
                    </button>
                    {confirming === d.slug ? (
                      <>
                        <button
                          className="dm-btn danger"
                          onClick={() =>
                            api.deleteDeck(d.slug).then(
                              () => props.onDeleted(d),
                              (e) => props.onError(String(e)),
                            )
                          }
                        >
                          Really delete
                        </button>
                        <button className="dm-btn" onClick={() => setConfirming(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button className="dm-btn danger" onClick={() => setConfirming(d.slug)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
                {d.builtin && <span className="dm-muted">built-in</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
