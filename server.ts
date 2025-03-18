import {
  Application,
  Context,
  Next,
  Router,
  send,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/oakCors.ts";
import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

// Import required types and functions from backend
import {
  hashPassword,
  verifyPassword,
  verifyTurnstileToken,
  findUserByUsername,
  createUser,
  validateUser,
  generateToken,
  initKV,
} from "./backend/cmd/server/auth.ts";

// Type definitions
interface AuthRequest {
  username: string;
  password: string;
  turnstileToken: string;
}

interface User {
  username: string;
  password: string;
  isAdmin: boolean;
  createdAt: Date;
}

const app = new Application();
const port = parseInt(Deno.env.get("PORT") || "8000");

// Load environment variables
if (!Deno.env.get("DENO_DEPLOYMENT_ID")) {
  try {
    const config = await load();
    for (const [key, value] of Object.entries(config)) {
      if (!(key in Deno.env.toObject())) {
        Deno.env.set(key, value as string);
      }
    }
    console.log("Environment variables loaded from .env file");
  } catch (error) {
    console.warn(
      "Failed to load .env file:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Add global error handler
app.addEventListener("error", (evt) => {
  console.error("Application error:", evt.error);
});

// Create API router
const router = new Router();

// API config endpoint
router.get("/api/config", (ctx) => {
  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") || "";
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID") || "local";

  if (!siteKey) {
    console.warn(
      "Warning: TURNSTILE_SITE_KEY not set in environment variables!"
    );
  }

  ctx.response.body = {
    turnstileSiteKey: siteKey,
    environment: deploymentId === "local" ? "development" : "production",
    serverTime: new Date().toISOString(),
    debug: true,
  };
});

// Login endpoint
router.post("/api/auth/login", async (ctx: Context) => {
  try {
    // Parse request body
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // Validate request data
    if (!body || !body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "Invalid request format" };
      return;
    }

    // Verify Turnstile token
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "CAPTCHA verification failed",
      };
      return;
    }

    // Validate user credentials
    const user = await validateUser(body.username, body.password);
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        error: "Invalid username or password",
      };
      return;
    }

    // Generate JWT token
    const token = await generateToken(user);

    // Return token and user info (excluding password)
    const { password, ...userInfo } = user;
    ctx.response.body = {
      success: true,
      token,
      user: userInfo,
      message: "Login successful",
    };
  } catch (error) {
    console.error(
      "Login error:",
      error instanceof Error ? error.message : String(error)
    );
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Register endpoint
router.post("/api/auth/register", async (ctx: Context) => {
  try {
    // Parse request body
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // Validate request data
    if (!body || !body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "Invalid request format" };
      return;
    }

    // Verify Turnstile token
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "CAPTCHA verification failed",
      };
      return;
    }

    // Username length constraints
    if (body.username.length < 3 || body.username.length > 20) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Username must be between 3-20 characters",
      };
      return;
    }

    // Password strength requirements
    if (body.password.length < 6) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Password must be at least 6 characters",
      };
      return;
    }

    // Create new user
    const newUser: User = {
      username: body.username,
      password: body.password, // Will be hashed in createUser function
      isAdmin: false, // Default to non-admin
      createdAt: new Date(),
    };

    const created = await createUser(newUser);
    if (!created) {
      ctx.response.status = 409; // Conflict
      ctx.response.body = { success: false, error: "Username already exists" };
      return;
    }

    ctx.response.body = {
      success: true,
      message: "User registration successful",
    };
  } catch (error) {
    console.error(
      "Registration error:",
      error instanceof Error ? error.message : String(error)
    );
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Status endpoint
router.get("/api/status", (ctx) => {
  ctx.response.body = {
    success: true,
    message: "Backend API is running",
    time: new Date().toISOString(),
  };
});

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
    await next();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Request error: ${errorMessage}`);

    ctx.response.status = err.status || 500;
    ctx.response.body = {
      success: false,
      error: err.message || "Internal server error",
    };
  } finally {
    const ms = Date.now() - start;
    console.log(
      `${ctx.request.method} ${ctx.request.url.pathname} - ${ctx.response.status} (${ms}ms)`
    );
  }
});

// CORS middleware
app.use(
  oakCors({
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Use API router
app.use(router.routes());
app.use(router.allowedMethods());

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

// If running directly, start the server
if (import.meta.main) {
  try {
    // Initialize database
    await initKV();
    console.log("Database initialization successful");

    // Start server
    console.log(`Starting server on port ${port}...`);

    // Get server IP address
    const networkInterfaces = Deno.networkInterfaces();
    let ipAddress = "localhost";

    // Try to find a non-internal IPv4 address
    for (const netInterface of networkInterfaces) {
      if (!netInterface.internal && netInterface.family === "IPv4") {
        ipAddress = netInterface.address;
        break;
      }
    }

    await app.listen({ port });

    // Log server URLs
    console.log(`Server is running!`);
    console.log(`Local:           http://localhost:${port}`);
    console.log(`On Your Network: http://${ipAddress}:${port}`);

    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      console.log(
        `Deployed at:     https://${Deno.env.get(
          "DENO_DEPLOYMENT_ID"
        )}.deno.dev`
      );
    }

    console.log(`API Status:      http://localhost:${port}/api/status`);
    console.log(`Press Ctrl+C to stop the server`);
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    Deno.exit(1);
  }
}
