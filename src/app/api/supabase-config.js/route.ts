function runtimeEnvironment(name: string) {
  return process.env[name]?.trim() || "";
}

export async function GET() {
  const config = {
    url:
      runtimeEnvironment("NEXT_PUBLIC_SUPABASE_URL") ||
      runtimeEnvironment("SUPABASE_URL"),
    publishableKey:
      runtimeEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      runtimeEnvironment("SUPABASE_PUBLISHABLE_KEY"),
  };

  return new Response(
    `window.__FR333MAN_SUPABASE_CONFIG__=${JSON.stringify(config)};`,
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/javascript; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
