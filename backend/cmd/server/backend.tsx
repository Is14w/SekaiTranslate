import {
  Application,
  Router,
  Context,
  isHttpError,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/oakCors.ts";
import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

// Type definitions
interface AuthRequest {
  username: string;
  password: string;
  turnstileToken: string;
}

interface User {
  username: string;
  password: string; // Stored hashed password
  isAdmin: boolean;
  createdAt: Date;
}

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
  } catch (error: unknown) {
    // Properly type the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Could not load .env file:", errorMessage);
  }
}

// Global variables
let kv: Deno.Kv | null = null;

// ======= PASSWORD UTILITY FUNCTIONS =======
async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Convert password to bytes
  const passwordBytes = new TextEncoder().encode(password);

  // Use PBKDF2 to hash the password
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    ),
    256
  );

  // Combine salt and key for storage
  const result = new Uint8Array(salt.length + key.byteLength);
  result.set(salt, 0);
  result.set(new Uint8Array(key), salt.length);

  // Return as base64
  return btoa(String.fromCharCode(...result));
}

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Decode the stored hash
    const hashData = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));

    // Extract salt (first 16 bytes)
    const salt = hashData.slice(0, 16);
    const storedKey = hashData.slice(16);

    // Hash the input password with the same salt
    const passwordBytes = new TextEncoder().encode(password);
    const key = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      await crypto.subtle.importKey(
        "raw",
        passwordBytes,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      ),
      256
    );

    // Compare the hashed input with stored hash
    const newKey = new Uint8Array(key);

    // Check if lengths match
    if (storedKey.length !== newKey.length) {
      return false;
    }

    // Compare each byte
    for (let i = 0; i < storedKey.length; i++) {
      if (storedKey[i] !== newKey[i]) {
        return false;
      }
    }

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Password verification error:", errorMessage);
    return false;
  }
}

// ======= TURNSTILE VERIFICATION =======
async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    const turnstileSecretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecretKey) {
      console.error("TURNSTILE_SECRET_KEY not set in environment variables");
      return false;
    }

    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: turnstileSecretKey,
          response: token,
        }),
      }
    );

    const data = await resp.json();
    return data.success === true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Turnstile verification error:", errorMessage);
    return false;
  }
}

// ======= DATABASE FUNCTIONS =======
async function connectToKV(): Promise<Deno.Kv> {
  try {
    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      return await Deno.openKv();
    } else {
      const kvUrl = Deno.env.get("KV_URL");
      if (!kvUrl) {
        console.warn("KV_URL not set. Using default local KV database");
        return await Deno.openKv();
      }
      const kv = await Deno.openKv(kvUrl);
      console.log("Successfully connected to remote KV database");
      return kv;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to connect to KV database:", errorMessage);
    throw error;
  }
}

async function initKV(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await connectToKV();
    console.log("KV database connection initialized");
  }
  return kv;
}

// ======= USER MANAGEMENT FUNCTIONS =======
async function findUserByUsername(username: string): Promise<User | null> {
  try {
    const db = await initKV();
    const result = await db.get<User>(["users", username]);
    return result.value;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error finding user:", errorMessage);
    return null;
  }
}

async function createUser(user: User): Promise<boolean> {
  try {
    const db = await initKV();

    // Check if user already exists
    const existingUser = await findUserByUsername(user.username);
    if (existingUser) {
      return false;
    }

    // Hash password
    const hashedPassword = await hashPassword(user.password);

    // Create new user with hashed password
    const newUser: User = {
      ...user,
      password: hashedPassword,
    };

    // Store user in KV database
    await db.set(["users", user.username], newUser);
    console.log("User created successfully:", user.username);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating user:", errorMessage);
    return false;
  }
}

async function validateUser(
  username: string,
  password: string
): Promise<User | null> {
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error validating user:", errorMessage);
    return null;
  }
}

// ======= JWT FUNCTIONS =======
async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    console.warn(
      "JWT_SECRET not set. Using default development key (not secure for production)"
    );
  }

  const jwtSecret = secret || "your-secret-key-for-development";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(jwtSecret);

  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function generateToken(user: User): Promise<string> {
  const key = await getJwtKey();

  const token = await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.username,
      exp: getNumericDate(60 * 60), // 1 hour expiration
      isAdmin: user.isAdmin,
    },
    key
  );

  return token;
}

function getNumericDate(exp: number): number {
  return Math.floor(Date.now() / 1000) + exp;
}

// ======= INITIALIZE APPLICATION =======
const app = new Application({
  logErrors: true, // Enable error logging
});
const router = new Router();

// Add error event listener for better debugging
app.addEventListener("error", (evt) => {
  console.error("Application error:", evt.error);
});

// ======= ROUTES =======

router.get("/api/config", (ctx) => {
  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") || "";
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID") || "local";

  // Log all environment variables for debugging
  console.log("All environment variables:", Object.keys(Deno.env.toObject()));
  console.log("Current environment:", {
    TURNSTILE_SITE_KEY: siteKey,
    DENO_DEPLOYMENT_ID: deploymentId,
    NODE_ENV: Deno.env.get("NODE_ENV"),
  });

  if (!siteKey) {
    console.warn(
      "WARNING: TURNSTILE_SITE_KEY is not set in environment variables!"
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Login error:", errorMessage);
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
      message: "User registered successfully",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Registration error:", errorMessage);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// ======= MIDDLEWARE =======

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
    await next();
  } catch (err: unknown) {
    // Proper error handling with type checking
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Request error: ${errorMessage}`);

    if (isHttpError(err)) {
      ctx.response.status = err.status;
      ctx.response.body = {
        success: false,
        error: err.message,
      };
    } else {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error: "Internal server error",
      };
    }
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
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

router.get("/api/status", (ctx) => {
  ctx.response.body = {
    success: true,
    message: "Backend API is running",
    time: new Date().toISOString(),
  };
});

// Apply routes
app.use(router.routes());
app.use(
  router.allowedMethods({
    throw: true, // Will throw an appropriate error when the method is not allowed
  })
);

// Fallback for unmatched routes
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { success: false, error: "Endpoint not found" };
});

// ======= INITIALIZE DATABASE =======
try {
  await initKV();
  console.log("Database initialized successfully");
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Failed to initialize database:", errorMessage);
}

if (import.meta.main) {
  // Parse command line arguments
  const args = Deno.args;
  let port = 8001; // Default backend port

  // Check for port argument
  const portIndex = args.indexOf("--port");
  if (portIndex >= 0 && portIndex < args.length - 1) {
    port = parseInt(args[portIndex + 1], 10);
  }

  console.log(`Starting backend server on port ${port}...`);
  await app.listen({ port });
}

// ======= EXPORT APPLICATION =======
export default app;
