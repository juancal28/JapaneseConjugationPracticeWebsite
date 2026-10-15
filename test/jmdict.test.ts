import { describe, expect, it } from "vitest";
import { classifyWithJmdict, loadJmdict, suggestFromPos } from "../server/classify/jmdict";

describe("suggestFromPos", () => {
  it("maps parts of speech to engine types", () => {
    expect(suggestFromPos(["v5k-s", "vi"], "行く")).toMatchObject({ type: "u", exception: "iku" });
    expect(suggestFromPos(["v1", "vt"], "食べる")).toMatchObject({ type: "ru", exception: null });
    expect(suggestFromPos(["vk", "vi"], "来る")).toMatchObject({ type: "irr" });
    expect(suggestFromPos(["n", "vs", "vt"], "勉強")).toMatchObject({ type: "skip", suruNoun: true });
    expect(suggestFromPos(["adj-na", "n"], "元気")).toMatchObject({ type: "na" });
    expect(suggestFromPos(["adj-ix"], "いい")).toMatchObject({ type: "i", exception: "ii" });
    expect(suggestFromPos(["n"], "本")).toMatchObject({ type: "skip", suruNoun: false });
  });
});

const index = loadJmdict();

describe.skipIf(!index)("classifyWithJmdict (needs npm run setup:jmdict)", () => {
  const cases: [string, string, string, string | null][] = [
    ["食べる", "たべる", "ru", null],
    ["行く", "いく", "u", "iku"],
    ["ある", "ある", "u", "aru"],
    ["帰る", "かえる", "u", null],
    ["来る", "くる", "irr", null],
    ["勉強する", "べんきょうする", "irr", null],
    ["勉強", "べんきょう", "skip", null],
    ["元気", "げんき", "na", null],
    ["きれい", "きれい", "na", null],
    ["高い", "たかい", "i", null],
    ["いい", "いい", "i", "ii"],
    ["下さる", "くださる", "u", "honorific"],
    ["くれる", "くれる", "ru", "kureru"],
  ];
  for (const [surface, reading, type, exception] of cases) {
    it(`${surface} -> ${type}${exception ? ` (${exception})` : ""}`, () => {
      const r = classifyWithJmdict(index!, surface, reading);
      expect(r.suggestion?.type).toBe(type);
      expect(r.suggestion?.exception ?? null).toBe(exception);
    });
  }
});
