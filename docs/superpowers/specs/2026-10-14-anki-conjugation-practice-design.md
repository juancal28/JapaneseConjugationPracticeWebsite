# Custom-deck Japanese Conjugation Practice: Design & Plan

## Context

The goal is to recreate https://steven-kraft.com/projects/japanese/randomize/ ("Random Verb Conjugation Practice") so it looks and behaves the same. It adds one big feature: **uploading Anki decks (.apkg) and practicing conjugation on only the words in the selected deck(s)**, such as one textbook chapter or one Duolingo unit.

Deck words get classified automatically (godan, ichidan, irregular, い-adjective, な-adjective, or skip). Each deck then gets a pre-computed **answer key**. Decks and answer keys are saved as JSON inside the repo, so `git commit`/`git pull` syncs them between computers. The app runs locally for now and should later deploy to Railway with a custom domain.

**Decisions made with the user**
- Practice **verbs and い/な adjectives**. Nouns are skipped.
- Classification: **JMdict lookup first, then a Claude API review of every word, then the user confirms in a review table**.
- Stack: **Node + Express + React (Vite) + TypeScript**.
- **Keep the built-in word lists** as default decks (90 verbs and 122 adjectives from the original site).
- Git storage: **JSON files only**: `decks/<slug>/words.json` and `decks/<slug>/answer-key.json`. The .apkg itself is not kept.

**Reference spec.** The original source was recovered from the site's public `.js.map` files (`sourcesContent`). The behavioral spec in "Appendix: reference behavior" below comes from that source. To port the logic accurately, fetch the original modules (e.g. `https://steven-kraft.com/component---src-components-layouts-verb-conjugation-js-3716b36a22380d46d4d6.js.map`, plus the shared chunks named in the appendix) into the scratchpad. Do not commit the original source.

**Caveat to tell the user:**
- The built-in word lists and visual design are Steven Kraft's work. That's fine for personal use, but check the license before hosting publicly.
- Railway's filesystem is ephemeral, so the "uploads land in git" workflow only works locally. Keep storage behind a `DeckStore` interface so a volume or GitHub-commit backend can be added later.

---

## Architecture

```
package.json            # one package; scripts: dev, build, start, test, setup:jmdict, keys:rebuild, builtin:build, fixture:reference
tsconfig.json  vite.config.ts (root: client/, proxy /api -> :3001)  vitest.config.ts
.env.example            # ANTHROPIC_API_KEY=, PORT=3001
.gitignore              # node_modules, dist, .env, data/jmdict/, .reference/
shared/                 # pure TS, imported by both server and client
  types.ts              # Word, WordType ('u'|'ru'|'irr'|'i'|'na'), WordException, DeckMeta, AnswerKey
  ruby.ts               # alignRuby(kanjiSurface, kana) -> '食<rt>た</rt>べる'
  conjugation/
    helpers.ts          # stem(), lastchar(), A/I/E/O row maps, irregularStem() generalized
    verbs/*.ts          # causative, conditional, imperative, negative, passive, past, polite, potential, provisional, te, volitional
    adjectives/*.ts     # conditional, naru, negative, past, volitional
    forms.ts            # registry: {id, label, subOpts:[{id,label}], appliesTo:'verb'|'adj', fn}
    answerKey.ts        # buildAnswerKey(words) -> every form x every sub-opt combo
server/
  index.ts              # Express: /api routes + serve dist/ in production
  routes/decks.ts
  anki/parseApkg.ts     # fflate unzip; collection.anki21b (fzstd) > anki21 > anki2; sql.js (WASM, no native build)
  anki/extract.ts       # field cleaning + auto field mapping
  classify/jmdict.ts    # loads data/jmdict/index.json, lookup(surface, reading)
  classify/claudeReview.ts
  classify/pipeline.ts  # extract -> jmdict -> claude -> ReviewRow[]
  store/deckStore.ts    # DeckStore interface + FsDeckStore(decks/)
scripts/
  setup-jmdict.ts       # download jmdict-simplified (eng, pinned release) -> build compact index (gitignored)
  build-builtin.ts      # extract original verbs.json/adjectives.json -> decks/builtin-verbs, decks/builtin-adjectives
  rebuild-keys.ts       # regenerate answer-key.json for every deck (after engine changes)
  reference-fixture.ts  # run ORIGINAL modules over the built-in lists -> test/fixtures/reference-answers.json
client/
  index.html  src/main.tsx  src/App.tsx            # routes: "/" practice, "/decks" manager
  src/practice/  Conjugation.tsx QuizMaster.tsx Question.tsx UserInput.tsx CorrectScore.tsx
                 Feedback.tsx Settings.tsx ToggleList.tsx Toggle.tsx Type.tsx English.tsx
                 DarkMode.tsx BackButton.tsx DeckPicker.tsx
  src/decks/     DeckManager.tsx UploadStep.tsx FieldMapping.tsx ReviewTable.tsx
  src/styles/    global.css (CSS vars light/dark, typography) + CSS modules per component
decks/                  # GIT-TRACKED
  builtin-verbs/{words.json, answer-key.json}
  builtin-adjectives/{words.json, answer-key.json}
  <slug>/{words.json, answer-key.json}
docs/superpowers/specs/2026-10-14-anki-conjugation-practice-design.md   # copy of this design, committed first
```

**Dependencies:** express, multer, fflate, sql.js, @anthropic-ai/sdk, zod, dotenv, react, react-dom, react-router-dom, wanakana@4.0.2 (same version as the original), vite, @vitejs/plugin-react, typescript, tsx, concurrently, vitest.

**Dev and prod:** `npm run dev` runs the Vite dev server (5173) and the Express server via tsx (3001) together through `concurrently`. `npm run build && npm start` makes Express serve `dist/`, which is the form Railway will use.

### Data shapes

`decks/<slug>/words.json`:
```jsonc
{ "name": "Genki Ch. 3", "slug": "genki-ch-3", "builtin": false,
  "source": { "file": "Genki.apkg", "ankiDeck": "Genki::Lesson 3", "importedAt": "2026-10-14T..." },
  "words": [
    { "id": "たべる|食べる", "kana": "たべる", "kanji": "食<rt>た</rt>べる", "eng": "eat",
      "type": "ru", "exception": null,             // 'iku' | 'aru' | 'honorific' | 'ii' | null
      "review": { "jmdictPos": ["v1","vt"], "claudeNote": "…", "changedByUser": false } } ] }
```
`decks/<slug>/answer-key.json` is deterministic and generated by `buildAnswerKey`:
```jsonc
{ "engineVersion": 1,
  "words": { "たべる|食べる": { "past": { "": {"kana":["たべた"],"kanji":["食<rt>た</rt>べた"]},
                                      "neg": {...}, "polite": {...}, "neg+polite": {...} },
                              "causative": { "short+passive": null, ... } } } }  // null = impossible combo
```
- Combo keys list the enabled sub-opt ids joined with `+`, in the registry's label order.
- Arrays hold every accepted answer (for example the potential ら-dropped form, or ないで/なくて).
- The kanji arrays are what Reverse mode with Show Kanji displays.

### Conjugation engine (`shared/conjugation`)
- Port each original `getAnswer(word, type, opts)` module faithfully. They operate on the kana string and the ruby-markup kanji string the same way: the word is everything but the last char, followed by the last char.
- **Generalize** the original's hard-coded irregular map:
  - Any word whose kana ends in `する` is a する-compound: replace the trailing する/為る.
  - Any word ending in `くる`/`来る` with JMdict `vk` is a 来る-compound.
  - Exceptions come from the word's `exception` field (set from JMdict tags), not string matching:
    - `v5k-s` → `iku`
    - `v5r-i` → `aru`
    - `v5aru` → `honorific` (くださる: ください/くださいます)
    - `adj-ix` → `ii` (いい/かっこいい → よ-stem)
- **Fix known source bugs:** the 勉強 kanji imperative gives "undefinedろ", and the 来る kanji imperative gives 来き ろ.
- **Golden test.** `scripts/reference-fixture.ts` runs the original modules (fetched from the source maps into gitignored `.reference/`) over all 90 verbs and 122 adjectives × every form × every sub-opt combo. It writes `test/fixtures/reference-answers.json`, which is committed; it's only data. The engine must match it exactly for **kana**. Kanji only differs where the bugs were fixed, and those cases are listed explicitly in the test.

### Practice page (`/`): same as the original, plus decks
- Port `conjugation.js`/`quiz_master.js` behavior exactly; see the appendix.
- **Question pool:** the union of words from the selected decks.
  - Verb forms apply to verbs; adjective forms apply to adjectives.
  - "No toggles on" means "all forms", per category, like the original.
- **Answers come from the loaded `answer-key.json`.** Pick a random applicable form, roll each sub-opt at 50%, then look up the combo. A `null` result draws a new word, like the original's `""`.
- **Settings fieldset:** the original three toggle lists, unchanged, plus one list of 5 adjective-form toggles ("Adj. Conditional/なる/Negative/Past/Volitional Form"). That list only renders when the selected decks contain adjectives.
- **Randomize Question** works for adjectives too. With the answer key this is trivial.
- **New "Decks" fieldset** below Settings, using the same Toggle component:
  - one toggle per deck, multi-select;
  - persisted in `localStorage.selectedDecks`;
  - nothing selected → `builtin-verbs`.
- **Back "‹" link** goes to `/decks`. The original's Google-Form feedback button is dropped because it points at the original author's form.
- **Fix the hang:** in `generateItem`, when the only remaining word is `lastword`, allow it. `previousAnswers` is keyed by word `id`, not by kanji.

### Deck manager (`/decks`)
- **List decks:** name, word count, verb/adjective counts, delete button (built-ins can't be deleted).
- **Upload .apkg** → `POST /api/import` (multipart). The server parses the file and returns:
  - the **Anki deck tree**, with note counts per subdeck, so you can import just "Lesson 3" out of a textbook deck;
  - the note types with their fields, and an auto-detected field mapping (expression / reading / meaning).
- **Field mapping step:** dropdowns per note type, pre-filled by the auto-detection.
  - Expression = the field with the most kanji/kana.
  - Reading = a kana-only field, or furigana brackets `漢字[かんじ]` inside the expression.
  - Meaning = the mostly-ASCII field.
- **Classify** → `POST /api/classify` → returns ReviewRows. Rows needing attention are highlighted:
  - Claude disagreed with JMdict,
  - no JMdict match,
  - low confidence.
- **Review table:** each row has
  - an include checkbox,
  - kana / kanji / English (editable),
  - a type dropdown (u, ru, irr, i, na, skip),
  - the JMdict POS,
  - Claude's note,
  - a live preview of 3 sample conjugations (past, negative, て) so mistakes are visible.
- **Save as deck** (name defaults to the Anki subdeck name) → `POST /api/decks`. The server writes both JSON files to `decks/<slug>/` and the UI shows "Saved. Commit `decks/<slug>/` to sync".
- **Edit an existing deck:** reopens the review table from words.json (no re-upload needed) → `PUT /api/decks/:slug` rewrites both files.

### Anki parsing (`server/anki`)
- An .apkg is a zip. Choose the collection file in this order:
  1. `collection.anki21b` (zstd, decompressed with Node's built-in zlib.zstdDecompressSync),
  2. `collection.anki21`,
  3. `collection.anki2`. Ignore the legacy "please update Anki" stub that newer exports also include.
- **Media is ignored.**
- Open the collection with sql.js.
- Schema 11 (legacy): note types and decks are JSON in the `col` table.
- Schema 18 (current): `notetypes`, `fields` and `decks` tables.
- Notes: `flds` split on `\x1f`. Deck membership comes via `cards.did`.
- **Cleaning:**
  - strip HTML and `&nbsp;`,
  - strip `[sound:…]`,
  - parse `漢字[かな]` furigana into surface + reading,
  - strip a leading `〜`/`~` and parenthetical notes,
  - when a field holds several words (`、`/`,`), take the first and flag the row,
  - convert katakana readings to hiragana (wanakana).

### Classification pipeline (`server/classify`)
1. **JMdict:** `scripts/setup-jmdict.ts` downloads a pinned jmdict-simplified `jmdict-eng` release.
   - It builds `data/jmdict/index.json`: surface (kanji form or kana) → `[{kanji[], kana[], pos[], gloss}]`.
   - Only entries with v1/v5*/vk/vs*/adj-i/adj-ix/adj-na POS are kept, plus `n`+`vs` nouns.
   - The index is gitignored; rerun `npm run setup:jmdict` on each machine (the README says so).
   - Lookup tries the surface plus the reading, then the reading alone, and returns the candidates.
   - A rule maps POS to type: v5* → u, v1 → ru, vk/vs-i/vs-s → irr, adj-i/adj-ix → i, adj-na → na.
   - A card "勉強" (noun, `vs`) → skip by default, with the note "add する to practice as verb". A card "勉強する" → irr.
2. **Claude review** (`claudeReview.ts`):
   - Uses `@anthropic-ai/sdk`, `client.beta.messages.parse` with `zodOutputFormat`, model `claude-opus-5-5`, `output_config: {effort: "medium"}`.
   - Server-side refusal fallback: `betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"`. Tell the user this is on.
   - Words are sent in batches of ≤100, run in parallel. Each item contains the raw fields, the cleaned expression/reading/meaning, and the JMdict candidates.
   - Output per item: `{id, include, kana, kanjiSurface, eng, type, exception, confidence: 'high'|'medium'|'low', note}`.
   - The system prompt explains the type taxonomy, the exceptions, and "skip nouns, phrases, and non-conjugatables".
   - Check `stop_reason === "refusal"` before reading.
   - With no `ANTHROPIC_API_KEY`, the step is skipped with a banner, and the table falls back to JMdict-only results.
3. **Server builds the ruby markup** with `alignRuby(kanjiSurface, kana)`:
   - match the kana runs of the surface as anchors in the reading;
   - each kanji run gets `<rt>` for the reading between the anchors;
   - if alignment fails, fall back to a whole-word ruby.
4. **Save:** `buildAnswerKey(words)` → write both files through `FsDeckStore`.

### API
`GET /api/decks` · `GET /api/decks/:slug` (words + answer key) · `POST /api/import` (apkg → tree, note types, mapping) · `POST /api/classify` (importId + selected subdecks + mapping → ReviewRows) · `POST /api/decks` · `PUT /api/decks/:slug` · `DELETE /api/decks/:slug`. Parsed imports are cached in memory by importId.

---

## Implementation order
1. Set up the project. Run `git init`, add .gitignore, and do the package.json/TS/Vite/Express skeleton. Copy this design to `docs/superpowers/specs/…-design.md` and commit.
2. `build-builtin.ts` + `reference-fixture.ts`: fetch the original sources from the source maps into `.reference/` → built-in deck words.json files + golden fixture.
3. Conjugation engine with tests (TDD against the golden fixture), then `buildAnswerKey`, then `rebuild-keys.ts`, then generate the built-in answer keys.
4. Practice page port: CSS variables, typography, toggles, IME, score, feedback, dark mode. Use built-in decks only at first. Compare with the original side by side.
5. Decks fieldset and multi-deck loading, plus adjective forms.
6. Anki parser + extraction, with tests on a generated schema-11 fixture apkg.
7. JMdict setup script + lookup + POS mapping tests.
8. Claude review + pipeline + `alignRuby` tests.
9. Deck manager UI: upload, mapping, review table, save/edit/delete.
10. README covering setup (`npm i`, `npm run setup:jmdict`, `.env`), the git workflow for decks, and Railway notes.

## Verification
- `npm test`:
  - The engine matches the original's kana answers for every built-in word × form × combo. Exceptions are only the listed kanji bug fixes.
  - Unit tests cover generalized irregulars (料理する, 持ってくる), くださる, かっこいい, alignRuby, the apkg parser (generated fixture), JMdict POS mapping, and answer-key enumeration.
- **Visual and behavioral parity:** run `npm run dev` and open both the original page and localhost side by side with the Chrome tools. Compare:
  - layout, toggles and dark mode;
  - typing romaji (n→ん on Enter), right and wrong answers (colors, "Last Answer" box, score/percent), invalid input shake, Enter to advance;
  - Shift for furigana with Show Kanji on, Reverse, Randomize Question, Hide Type, Show English, and persistence across reloads.
- **End to end with a real deck:** upload one of your .apkg exports, try both a new Anki export and one made with "support older versions".
  1. Pick a subdeck and check the field mapping.
  2. Classify, and confirm the Claude notes appear and the flagged rows make sense. Edit a row, then save.
  3. `git status` shows `decks/<slug>/words.json` and `answer-key.json`.
  4. Select only that deck on `/` and confirm questions come only from it.
  5. Spot-check answers against the answer key.
  6. `npm run build && npm start` serves the same app from Express.

---

## Appendix: reference behavior (from the original source)

**Data.** verbs.json has 90 entries `{kana, kanji(ruby HTML), type: u|ru|irr, eng}`. adjectives.json has 122 entries (type i|na). Type labels: う-Verb (Godan), る-Verb (Ichidan), Irregular Verb, い-Adjective, な-Adjective. The type line renders `"{label} "` and never shows "(Exception)" on the random page.

**Randomize.**
- Enabled forms, where none enabled means all. For verbs, exclude `questionConj` (the form used to build the question).
- Pick one form, then roll each of its sub-opts at 50%.
- `formLabel = labels.join(" ") + " " + formLabel`, shown as `<h3 id="random" style="margin:0">{formLabel} Form</h3>` (for example "Negative Polite Past Form" or " て Form").

| Form | Sub-opts |
|---|---|
| causative | short, neg, polite, passive |
| conditional | neg, polite |
| imperative | neg, polite |
| negative | polite |
| passive | neg, polite |
| past | neg, polite |
| polite | neg |
| potential | neg, polite |
| provisional | neg, polite |
| te | neg, polite |
| volitional | polite |

| Adjective form | Sub-opts |
|---|---|
| adj-conditional | neg |
| adj-naruform | neg, polite |
| adj-negative | polite |
| adj-past | neg, polite |
| adj-volitional | polite |

**Randomize Question (verbs).**
- Candidates are the enabled forms plus "plain". If the pick is plain, or there are ≤2 candidates, the question is the dictionary form.
- Otherwise conjugate with random sub-opts and take `[0]` if the result is an array. Remember the form so the answer uses a different one.
- Turning it on turns Reverse off. Not persisted.

**Reverse.**
- The question is the conjugated answer (kanji answer if Show Kanji is on, otherwise kana; a random element if it's an array). The expected answer is `word.kana`.
- Turning it on turns Randomize Question off. Not persisted.

**Question box.**
- Shows kana by default. With Show Kanji, it shows the ruby HTML with the first `<rt>`/`</rt>` wrapped in `<rp>(</rp>`.
- `rt{display:none}` unless furigana is on.
- Shift keydown toggles furigana, but only while Show Kanji is on.
- Kanji off forces furigana off; furigana on forces kanji on.

**Input** (wanakana 4.0.2 `bind`, defaults).
- Focus on mount. A window click focuses the input when width > 650.
- Enter is a window-level listener:
  - A trailing `n` after hiragana becomes `ん`.
  - In the wait state, Enter clears the input and loads a new word.
  - Otherwise, hiragana that's non-empty and ≤50 characters gets submitted.
  - Anything else shakes the input (the class is removed after 500ms).
- Grading compares kana: `answer === input`, or the answer array includes it.
- After grading, the input gets class correct (`--green` background) or incorrect (`--red`); the text stays.
- The score counter increments. A correct answer adds the word to `previousAnswers` (cleared once it's full).
- The Feedback box shows `Last Answer: {answers joined " or "}`. Background is `#bfefbf` for correct and `#f39292` for incorrect; it's hidden when status is empty.
- `#meaning` is always empty.

**Score:** `C/I/P`, with `P = i===0 ? "100%" : ceil(c/(c+i)*100)+"%"`.

**Persistence:** localStorage `showKanji`, `showFuri`, `hideType`, `showEnglish` (strings "true"/"false"), all false by default. Form toggles are not persisted, but URL params `?<formId>=true&reverse=true` preset them. Theme is `localStorage.theme`, falling back to prefers-color-scheme, with a `dark`/`light` class on body.

**Layout and CSS:**
- **Element order:** h1 ("Random Verb Conjugation Practice", 36px/40px, margin 18px 0 10px), question box (2em, `--bgQuestion`, padding 10px 0, display table, width 100%), form label h3, English h3, input (28px Open Sans, border-radius 10px, centered), type h3 (margin-top 15px), score h3, feedback, settings fieldset (legend 21px; ul toggle lists with an empty `<div>` after every 4th item; li inline-block, margin 0 14px; h4 14px `--toggleHeading`; switch 4em×2.2em pill).
- **Body:** text-align center, position absolute, min-height 100%.
- **Buttons row:** absolute bottom, holding the 32px round dark-mode checkbox floated right.
- **Typography:** Open Sans 300/400; the typography-theme-bootstrap scale (16px base, 1.5 line-height).
- **Colors:**

| Variable | Light | Dark |
|---|---|---|
| `--bg` | #fff | #1a1b26 |
| `--textNormal` | #111 | #a9b1d6 |
| `--bgQuestion` | #eee | #24283b |
| `--bgInput` | #fff | #1a1b26 |
| `--borderInput` | #ddd | #414868 |
| `--textInput` | #000 | #a9b1d6 |
| `--correctText` | #000 | #1a1b26 |
| `--toggleHeading` | #777 | #565f89 |
| `--bgToggle` | #e0e0e0 | #24283b |
| `--fgToggle` | #fff | #c0caf5 |
| `--darkmodeButton` | #1a1b26 | #fff |
| `--red` | #eb4d4d | #f7768e |
| `--green` | #82e082 | #9ece6a |

- **Shake:** keyframes ±2/4/8px over .82s. Full CSS values are in the original page HTML and source maps.

**Conjugation rules.** Port them verbatim from `src/components/japanese/verbs/*.js` and `adjectives/adj-*.js` in the source maps. The golden fixture enforces them.


## Implementation notes (2026-10-14)

- Verb and adjective forms live in shared/conjugation/verbs.ts and adjectives.ts (one file each, not one file per form).
- fzstd was replaced by Node 22.15+'s built-in zstd.
- The golden test compares kana only; kanji differs from the original wherever the original's ruby was wrong.
- The ある negative conditional/provisional were fixed to なかったら/なければ.
