import { describe, expect, it } from "vitest";
import { validateWords, wordProblem } from "../shared/validate";
import { rubyHtml } from "../shared/ids";
import type { Word } from "../shared/types";

const word = (patch: Partial<Word>): Word => ({ id: "x", kana: "たべる", kanji: "食<rt>た</rt>べる", eng: "eat", type: "ru", exception: null, ...patch });

describe("word validation", () => {
  it("accepts well-formed words", () => {
    expect(wordProblem(word({}))).toBeNull();
    expect(wordProblem(word({ kana: "べんきょうする", kanji: "勉強<rt>べんきょう</rt>する", type: "irr" }))).toBeNull();
    expect(wordProblem(word({ kana: "ゆうめい", kanji: "有名<rt>ゆうめい</rt>", type: "na" }))).toBeNull();
  });

  it("rejects HTML other than ruby tags", () => {
    expect(wordProblem(word({ kanji: '<img src=x onerror="alert(1)">る' }))).toMatch(/ruby tags/);
    expect(wordProblem(word({ kanji: "食<rt>た</rt>べる<script>" }))).toMatch(/ruby tags/);
  });

  it("rejects words the engine can't conjugate", () => {
    expect(wordProblem(word({ type: "i" }))).toMatch(/い-adjectives/);
    expect(wordProblem(word({ kana: "taberu" }))).toMatch(/hiragana/);
    expect(wordProblem(word({ kana: "たべる", kanji: "食<rt>た</rt>べ", type: "ru" }))).toMatch(/same kana/);
    expect(validateWords([word({}), word({})])).toEqual(["たべる: duplicate word"]);
  });
});

describe("rubyHtml", () => {
  const r = (base: string, reading: string) => `<ruby>${base}<rp>(</rp><rt>${reading}</rt><rp>)</rp></ruby>`;

  it("puts each reading over only its own kanji", () => {
    // Kana between kanji used to pull わる over が悪.
    expect(rubyHtml("目<rt>め</rt>が悪<rt>わる</rt>い")).toBe(`${r("目", "め")}が${r("悪", "わる")}い`);
    expect(rubyHtml("お母<rt>かあ</rt>さん")).toBe(`お${r("母", "かあ")}さん`);
    expect(rubyHtml("持<rt>も</rt>って来<rt>こ</rt>ない")).toBe(`${r("持", "も")}って${r("来", "こ")}ない`);
  });

  it("keeps multi-kanji readings together and handles the original's markup", () => {
    expect(rubyHtml("勉強<rt>べんきょう</rt>する")).toBe(`${r("勉強", "べんきょう")}する`);
    expect(rubyHtml("<rb>行</rb><rt>い</rt>く")).toBe(`${r("行", "い")}く`);
    expect(rubyHtml("食<rp>(</rp><rt>た</rt><rp>)</rp>べる")).toBe(`${r("食", "た")}べる`);
    expect(rubyHtml("たべる")).toBe("たべる");
  });

  it("escapes everything else", () => {
    expect(rubyHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(rubyHtml("悪<rt><b>x</b></rt>")).toBe(r("悪", "&lt;b&gt;x&lt;/b&gt;"));
  });
});
