import { describe, expect, it } from "vitest";
import { alignRuby } from "../shared/ruby";

describe("alignRuby", () => {
  const cases: [string, string, string][] = [
    ["食べる", "たべる", "食<rt>た</rt>べる"],
    ["勉強する", "べんきょうする", "勉強<rt>べんきょう</rt>する"],
    ["持って来る", "もってくる", "持<rt>も</rt>って来<rt>く</rt>る"],
    ["お母さん", "おかあさん", "お母<rt>かあ</rt>さん"],
    ["取り扱う", "とりあつかう", "取<rt>と</rt>り扱<rt>あつか</rt>う"],
    ["有名", "ゆうめい", "有名<rt>ゆうめい</rt>"],
    ["たべる", "たべる", "たべる"],
    ["時々", "ときどき", "時々<rt>ときどき</rt>"],
  ];
  for (const [surface, reading, want] of cases) {
    it(`${surface} / ${reading}`, () => {
      expect(alignRuby(surface, reading)).toEqual({ ruby: want, aligned: true });
    });
  }

  it("falls back to keeping the okurigana when the reading doesn't line up", () => {
    // Reading written for a different okurigana spelling.
    expect(alignRuby("行なう", "おこなう")).toEqual({ ruby: "行<rt>おこ</rt>なう", aligned: true });
    expect(alignRuby("表す", "あらわす")).toEqual({ ruby: "表<rt>あらわ</rt>す", aligned: true });
    expect(alignRuby("見せる", "みる")).toEqual({ ruby: "見せ<rt>み</rt>る", aligned: false });
  });
});
