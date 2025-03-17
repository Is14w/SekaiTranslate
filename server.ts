import backendApp from "./backend/cmd/server/backend.tsx";
import {
  Application,
  Context,
  Next,
  send,
} from "https://deno.land/x/oak@v17.1.4/mod.ts";

const app = backendApp;
const port = parseInt(Deno.env.get("PORT") || "8000");

app.use((async (context: Context, next: Next) => {
  try {
    const path = context.request.url.pathname;
    // First try to serve static files from dist directory
    if (path === "/" || path === "/index.html") {
      await send(context, "/index.html", {
        root: `${Deno.cwd()}/dist`,
      });
      return;
    }

    await send(context, path, {
      root: `${Deno.cwd()}/dist`,
    });
  } catch {
    await next();
  }
}) as unknown as Parameters<typeof app.use>[0]);

// Add startup logging
app.addEventListener("listen", ({ hostname, port, secure }) => {
  console.log(
    `🚀 Server running on ${secure ? "https://" : "http://"}${
      hostname ?? "localhost"
    }:${port}`
  );
  console.log(
    `Environment: ${
      !!Deno.env.get("DENO_DEPLOYMENT_ID") ? "Production" : "Development"
    }`
  );
});

// Export for Deno Deploy
export default app;

// Start server if running directly
if (import.meta.main) {
  console.log(`Starting server on port ${port}...`);
  await app.listen({ port });
}
