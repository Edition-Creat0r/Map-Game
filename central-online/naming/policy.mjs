// One server policy. Full term/exception lists come from server secrets, never clients.
import {
  assignedRanges,
  confusables,
  digits,
  folds,
  unicodeVersion,
} from "./data/unicode.mjs";
export { unicodeVersion };
export const kinds = ["username", "kingdom", "city", "alliance", "building"];
export function fold(value) {
  return Array.from(value.normalize("NFKC"), (c) => folds[c] ?? c).join("")
    .normalize("NFC");
}
function assigned(c) {
  const n = c.codePointAt(0);
  let lo = 0, hi = assignedRanges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, [a, b] = assignedRanges[mid];
    if (n < a) hi = mid - 1;
    else if (n > b) lo = mid + 1;
    else return true;
  }
  return false;
}
const leet = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  8: "b",
  9: "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "l",
};
export function skeleton(value, { obfuscation = false } = {}) {
  let text = fold(value);
  if (obfuscation) {
    text = Array.from(text, (c) => leet[digits[c] ?? c] ?? (digits[c] ?? c))
      .join("");
  }
  return Array.from(text.normalize("NFD"), (c) => confusables[c] ?? c).join("")
    .normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(
      /(.)\1{2,}/gu,
      "$1",
    );
}
const compact = (v) => v.replace(/[^\p{L}\p{N}]/gu, "");
function tokens(value) {
  return skeleton(value.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2"), {
    obfuscation: true,
  }).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function compileRules(rules) {
  const words = new Set(), whole = new Set(), prefix = [];
  for (const r of rules) {
    const term = compact(skeleton(r.value, { obfuscation: true }));
    if (!term) throw Error("Empty private rule");
    if (r.mode === "word") words.add(term);
    else if (r.mode === "whole") whole.add(term);
    else prefix.push(term);
  }
  return { words, whole, prefix };
}
function context(value) {
  const a = tokens(value), fragments = new Set();
  for (let i = 0; i < a.length; i++) {
    let part = "";
    for (let j = i; j < a.length; j++) {
      part += a[j];
      fragments.add(part);
    }
  }
  return { joined: a.join(""), fragments };
}
function matches(ctx, rules) {
  if (
    rules.whole.has(ctx.joined) ||
    rules.prefix.some((p) => ctx.joined.startsWith(p))
  ) return true;
  for (const part of ctx.fragments) if (rules.words.has(part)) return true;
  return false;
}
export async function compilePolicy(raw, { allowTestPolicy = false } = {}) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (data?.testOnly && !allowTestPolicy) {
    throw Error("Test policy is not a production policy");
  }
  if (
    data?.version !== 1 || !Array.isArray(data.terms) || !data.terms.length ||
    !Array.isArray(data.reserved) || !data.reserved.length ||
    data.terms.length > 20000 || data.reserved.length > 2000
  ) throw Error("Server naming policy is not configured");
  for (const r of [...data.terms, ...data.reserved]) {
    if (
      !r || typeof r.value !== "string" || !r.value.trim() ||
      r.value.length > 120 || !["word", "whole", "prefix"].includes(r.mode)
    ) throw Error("Invalid private policy entry");
  }
  const terms = compileRules(data.terms),
    reserved = compileRules(data.reserved);
  const allow = new Set(
    (data.allowWhole || []).map((v) => fold(v.trim().replace(/\s+/gu, " "))),
  );
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    hash,
    assess(name, kind) {
      if (
        !kinds.includes(kind) || typeof name !== "string" ||
        name.length > 256 || !Array.from(name).every(assigned)
      ) return { decision: "reject" };
      const display = name.normalize("NFKC").trim().replace(/\p{Z}+/gu, " ");
      const length = Array.from(display).length;
      if (
        length < (kind === "username" ? 3 : 2) ||
        length > (kind === "username" ? 24 : 48) ||
        /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u.test(name) ||
        !(/^[\p{L}\p{M}\p{N} ._’'\-]+$/u.test(display)) ||
        (kind === "username" && (/[ ’']/u.test(display))) ||
        !/[\p{L}\p{N}]/u.test(display)
      ) return { decision: "reject" };
      const ctx = context(display);
      if (matches(ctx, reserved)) return { decision: "reject" };
      if (!allow.has(fold(display)) && matches(ctx, terms)) {
        return {
          decision: "reject",
        };
      }
      const latin = /\p{Script=Latin}/u.test(display),
        other = /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(display);
      return {
        decision: latin && other ? "review" : "approve",
        display,
        key: fold(display),
        skeleton: skeleton(display),
      };
    },
  };
}
