// Executes the actual Deno.serve entry with no credentials and networking isolated.
Deno.test("deployed entry defaults to disabled and rejects unapproved origins", async () => {
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-net",
      "/backend/supabase/functions/central-economy/index.ts",
    ],
    env: { CENTRAL_ECONOMY_ENABLED: "false" },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  try {
    let response: Response | undefined;
    for (let i = 0; i < 40; i++) {
      try {
        response = await fetch("http://127.0.0.1:8000/");
        break;
      } catch (_) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (!response || response.status !== 503) {
      throw Error("Actual entry must default OFF");
    }
    if ((await response.json()).error !== "central_economy_disabled") {
      throw Error("Wrong disabled response");
    }
    const denied = await fetch("http://127.0.0.1:8000/", {
      method: "OPTIONS",
      headers: { Origin: "https://unapproved.test" },
    });
    if (denied.status !== 403) throw Error("Unexpected origin accepted");
    await denied.body?.cancel();
  } finally {
    child.kill("SIGTERM");
    await child.output();
  }
});
