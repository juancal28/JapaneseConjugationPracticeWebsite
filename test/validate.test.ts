import { describe, expect, it } from "vitest";
import { validateWords, wordProblem } from "../shared/validate";
import { safeRubyHtml } from "../shared/ids";
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

describe("safeRubyHtml", () => {
  it("keeps ruby tags and escapes everything else", () => {
    expect(safeRubyHtml("食<rp>(</rp><rt>た</rt><rp>)</rp>べる")).toBe("食<rp>(</rp><rt>た</rt><rp>)</rp>べる");
    expect(safeRubyHtml("<ruby>書<rt>か</rt>いた</ruby> or <ruby>書<rt>か</rt>く</ruby>")).toBe(
      "<ruby>書<rt>か</rt>いた</ruby> or <ruby>書<rt>か</rt>く</ruby>",
    );
    expect(safeRubyHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(safeRubyHtml('<ruby onclick="x">')).toBe("&lt;ruby onclick=&quot;x&quot;&gt;");
  });
});
