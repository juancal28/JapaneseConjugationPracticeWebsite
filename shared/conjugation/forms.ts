import type { FormFn } from "./helpers";
import * as V from "./verbs";
import * as Adj from "./adjectives";

export interface SubOpt {
  id: string;
  label: string;
}

export interface FormDef {
  id: string;
  /** Label as used in the "<sub-opts> <label> Form" heading. */
  label: string;
  /** Label on the settings toggle (without " Form"). */
  toggleLabel: string;
  appliesTo: "verb" | "adj";
  subOpts: SubOpt[];
  fn: FormFn;
}

const NEG = { id: "neg", label: "Negative" };
const POLITE = { id: "polite", label: "Polite" };

/** Same ids, labels, sub-opt order and settings order as the original randomize.js. */
export const VERB_FORMS: FormDef[] = [
  { id: "causative", label: "Causative", subOpts: [{ id: "short", label: "Short" }, NEG, POLITE, { id: "passive", label: "Passive" }], fn: V.causative },
  { id: "conditional", label: "Conditional", subOpts: [NEG, POLITE], fn: V.conditional },
  { id: "imperative", label: "Imperative", subOpts: [NEG, POLITE], fn: V.imperative },
  { id: "negative", label: "Negative", subOpts: [POLITE], fn: V.negative },
  { id: "passive", label: "Passive", subOpts: [NEG, POLITE], fn: V.passive },
  { id: "past", label: "Past", subOpts: [NEG, POLITE], fn: V.past },
  { id: "polite", label: "Polite", subOpts: [NEG], fn: V.polite },
  { id: "potential", label: "Potential", subOpts: [NEG, POLITE], fn: V.potential },
  { id: "provisional", label: "Provisional", subOpts: [NEG, POLITE], fn: V.provisional },
  { id: "te", label: "て", subOpts: [NEG, POLITE], fn: V.te },
  { id: "volitional", label: "Volitional", subOpts: [POLITE], fn: V.volitional },
].map((f) => ({ ...f, toggleLabel: f.label, appliesTo: "verb" as const }));

/** Same as the original adj-randomize.js; toggles get an "Adj." prefix to tell them apart from verb toggles. */
export const ADJ_FORMS: FormDef[] = [
  { id: "adj-conditional", label: "Conditional", subOpts: [NEG], fn: Adj.adjConditional },
  { id: "adj-naruform", label: "なる", subOpts: [NEG, POLITE], fn: Adj.adjNaru },
  { id: "adj-negative", label: "Negative", subOpts: [POLITE], fn: Adj.adjNegative },
  { id: "adj-past", label: "Past", subOpts: [NEG, POLITE], fn: Adj.adjPast },
  { id: "adj-volitional", label: "Volitional", subOpts: [POLITE], fn: Adj.adjVolitional },
].map((f) => ({ ...f, toggleLabel: "Adj. " + f.label, appliesTo: "adj" as const }));

export const ALL_FORMS: FormDef[] = [...VERB_FORMS, ...ADJ_FORMS];
export const FORMS_BY_ID: Record<string, FormDef> = Object.fromEntries(ALL_FORMS.map((f) => [f.id, f]));

/** Combo key for a set of enabled sub-opts, in the form's sub-opt order: "", "neg", "neg+polite", ... */
export function comboKey(form: FormDef, opts: Record<string, boolean>): string {
  return form.subOpts.filter((o) => opts[o.id]).map((o) => o.id).join("+");
}

/** Every sub-opt combination of a form, as opts objects. */
export function allCombos(form: FormDef): Record<string, boolean>[] {
  const n = form.subOpts.length;
  const combos: Record<string, boolean>[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const opts: Record<string, boolean> = {};
    form.subOpts.forEach((o, i) => (opts[o.id] = (mask & (1 << i)) !== 0));
    combos.push(opts);
  }
  return combos;
}
