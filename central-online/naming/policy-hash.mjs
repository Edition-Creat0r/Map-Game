// Read the reviewed private policy from stdin; print only its fingerprint.
import { compilePolicy } from "./policy.mjs";
import { readFileSync } from "node:fs";
try {
  const text = readFileSync(0, "utf8");
  if (text.length > 2097152) throw Error();
  console.log((await compilePolicy(text)).hash);
} catch (_) {
  console.error(
    "Private naming policy could not be validated. No policy text was logged.",
  );
  process.exit(1);
}
