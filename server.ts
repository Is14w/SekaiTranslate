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

// API requests - proxy to backend app
app.use(async (ctx: Context, next: Next) => {
  const path = ctx.request.url.pathname;

  if (path.startsWith("/api")) {
    try {
      console.log(`Proxying API request: ${path}`);

      // Get request method and body
      const method = ctx.request.method;
      const headers = Object.fromEntries(ctx.request.headers.entries());

      // Remove host header to avoid conflicts
      delete headers.host;

      // Get request body if applicable
      let body = undefined;
      if (method !== "GET" && method !== "HEAD") {
        if (ctx.request.hasBody) {
          const bodyResult = ctx.request.body({ type: "json" });
          try {
            body = await bodyResult.value;
          } catch (e) {
            console.warn("Could not parse request body as JSON:", e);
          }
        }
      }

      // Forward the request to the backend
      const backendUrl = `http://localhost:${BACKEND_PORT}${path}${
        ctx.request.url.search || ""
      }`;
      console.log(`Forwarding to: ${backendUrl}`);

      const response = await fetch(backendUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Copy the response from backend to client
      ctx.response.status = response.status;

      // Copy response headers
      for (const [key, value] of response.headers.entries()) {
        ctx.response.headers.set(key, value);
      }

      // Get response content type to determine how to handle the body
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        // Handle JSON response
        ctx.response.body = await response.json();
      } else {
        // Handle other response types (text, binary, etc.)
        ctx.response.body = await response.arrayBuffer();
      }

      return;
    } catch (error) {
      console.error(`Error proxying API request:`, error);
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
  // Start backend server in a subprocess
  const startBackend = async () => {
    console.log(`Starting backend server on port ${BACKEND_PORT}...`);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "--allow-write",
        "./backend/cmd/server/backend.tsx",
        "--port",
        BACKEND_PORT.toString(),
      ],
      stdout: "inherit",
      stderr: "inherit",
    });

    const process = command.spawn();

    // Handle process exit
    process.status.then((status) => {
      console.log(`Backend process exited with code: ${status.code}`);
      if (!status.success) {
        console.error("Backend process failed, restarting...");
        setTimeout(startBackend, 5000); // Restart after 5 seconds
      }
    });

    return process;
  };

  // Start backend
  const backendProcess = await startBackend();

  // Start frontend server
  console.log(`Starting server on port ${port}...`);
  try {
    await app.listen({ port });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    // Kill backend process before exiting
    backendProcess.kill("SIGTERM");
    Deno.exit(1);
  }
}
