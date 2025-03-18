import backendApp from "./backend/cmd/server/backend.tsx";
import {
  Application,
  Context,
  Next,
  send,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const port = parseInt(Deno.env.get("PORT") || "8000");
const BACKEND_PORT = parseInt(Deno.env.get("BACKEND_PORT") || "8001"); // Different port for backend

// Add global error handler
app.addEventListener("error", (evt) => {
  console.error("Application error:", evt.error);
});

// API requests - directly use the backend app
app.use(async (ctx: Context, next: Next) => {
  const path = ctx.request.url.pathname;

  if (path.startsWith("/api")) {
    try {
      console.log(`Handling API request: ${path}`);

      // Use the backend app directly instead of making a fetch
      await backendApp.handle(ctx.request, ctx.response);
      return;
    } catch (error) {
      console.error(`Error handling API request:`, error);
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error: "Internal server error while processing API request",
      };
    }
    return;
  }

  await next();
});

// Static file middleware
app.use(async (ctx: Context, next: Next) => {
  try {
    const path = ctx.request.url.pathname;
    console.log(`Attempting to serve static file: ${path}`);

    // First try to serve static files from dist directory
    if (path === "/" || path === "/index.html") {
      await send(ctx, "/index.html", {
        root: `${Deno.cwd()}/dist`,
      });
      return;
    }

    await send(ctx, path, {
      root: `${Deno.cwd()}/dist`,
    });
  } catch (error) {
    console.log(`Static file not found, continuing to next middleware`);
    await next();
  }
});

// Fallback to SPA mode - serve index.html for any unmatched routes
app.use(async (ctx: Context) => {
  console.log(
    `Fallback: serving index.html for path: ${ctx.request.url.pathname}`
  );
  try {
    await send(ctx, "/index.html", {
      root: `${Deno.cwd()}/dist`,
    });
  } catch (error) {
    console.error(`Error serving fallback index.html: ${error.message}`);
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: "Resource not found" };
  }
});

// Export for Deno Deploy
export default app;

// Start server if running directly
if (import.meta.main) {
  console.log(`Starting server on port ${port}...`);
  try {
    await app.listen({ port });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    Deno.exit(1);
  }
}
