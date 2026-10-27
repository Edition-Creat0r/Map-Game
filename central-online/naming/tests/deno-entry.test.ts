Deno.test("naming entry stays disabled with no private policy and rejects unapproved origins", async () => {
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-net",
      "/naming/supabase/functions/public-names/index.ts",
    ],
    env: { PUBLIC_NAMING_ENABLED: "false" },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  try {
    let r: Response | undefined;
    for (let i = 0; i < 40; i++) {
      try {
        r = await fetch("http://127.0.0.1:8000/");
        break;
      } catch (_) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (r?.status !== 503) throw Error("Naming must default OFF");
    await r.body?.cancel();
    const denied = await fetch("http://127.0.0.1:8000/", {
      headers: { Origin: "https://unapproved.test" },
    });
    if (denied.status !== 403) throw Error("Origin accepted");
    await denied.body?.cancel();
  } finally {
    child.kill("SIGTERM");
    await child.output();
  }
});
Deno.test("deployment refuses the deliberately incomplete test-only policy", async () => {
  const fixture = await Deno.readTextFile("/naming/tests/fixture-policy.json");
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-net",
      "/naming/supabase/functions/public-names/index.ts",
    ],
    env: {
      PUBLIC_NAMING_ENABLED: "true",
      NAMING_POLICY_JSON: fixture,
      SUPABASE_URL: "https://staging.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "isolated-test-placeholder",
      SUPABASE_ANON_KEY: "isolated-test-placeholder",
      CENTRAL_ALLOWED_ORIGINS: "https://game.test",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (
    result.success ||
    !new TextDecoder().decode(result.stderr).includes("Test policy")
  ) throw Error("Test policy was accepted");
});
