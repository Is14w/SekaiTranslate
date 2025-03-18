import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";

// Enhanced user type with role levels
export interface User {
  username: string;
  password: string; // stored hashed password
  isAdmin: boolean;
  role: "user" | "admin" | "superadmin"; // Enhanced role system
  createdAt: Date;
  invitedBy?: string; // Track who invited this admin
}

// Invitation code structure
export interface InvitationCode {
  code: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  usedBy?: string;
  usedAt?: Date;
  isUsed: boolean;
}

// Global variables
let kv: Deno.Kv | null = null;

// In-memory storage as fallback
const memoryStorage = new Map<string, any>();

// ======= Password utility functions =======
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Convert password to bytes
  const passwordBytes = new TextEncoder().encode(password);

  // Hash password with PBKDF2
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

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Decode stored hash
    const hashData = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));

    // Extract salt (first 16 bytes)
    const salt = hashData.slice(0, 16);
    const storedKey = hashData.slice(16);

    // Hash input password with same salt
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

    // Compare hashed input with stored hash
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
  } catch (error) {
    console.error(
      "Password verification error:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// ======= TURNSTILE verification =======
export async function verifyTurnstileToken(token: string): Promise<boolean> {
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
  } catch (error) {
    console.error(
      "Turnstile verification error:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// ======= Database functions =======
export async function connectToKV(): Promise<Deno.Kv | null> {
  try {
    // Check if Deno.openKv is available
    if (typeof Deno.openKv !== "function") {
      console.warn(
        "Deno KV API is not available. Using in-memory storage instead."
      );
      return null; // Return null to use in-memory storage
    }

    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      return await Deno.openKv();
    } else {
      const kvUrl = Deno.env.get("KV_URL");
      if (!kvUrl) {
        console.warn("KV_URL is not set. Using default local KV database");
        return await Deno.openKv();
      }
      const kv = await Deno.openKv(kvUrl);
      console.log("Successfully connected to KV database");
      return kv;
    }
  } catch (error) {
    console.error(
      "Failed to connect to KV database:",
      error instanceof Error ? error.message : String(error)
    );
    console.warn("Falling back to in-memory storage");
    return null;
  }
}

export async function initKV(): Promise<Deno.Kv | null> {
  if (!kv) {
    kv = await connectToKV();
    console.log("KV database connection initialized");

    // Create superadmin if it doesn't exist yet
    await createInitialSuperAdmin();
  }
  return kv;
}

// Create initial superadmin if needed
async function createInitialSuperAdmin(): Promise<void> {
  try {
    const superadminUsername = Deno.env.get("SUPERADMIN_USERNAME");
    const superadminPassword = Deno.env.get("SUPERADMIN_PASSWORD");

    if (!superadminUsername || !superadminPassword) {
      console.warn(
        "SUPERADMIN credentials not configured. Skipping superadmin creation."
      );
      return;
    }

    // Check if superadmin already exists
    const existingSuperadmin = await findUserByUsername(superadminUsername);
    if (existingSuperadmin) {
      console.log("Superadmin account already exists");
      return;
    }

    // Create superadmin user
    const superadmin: User = {
      username: superadminUsername,
      password: superadminPassword, // Will be hashed in createUser
      isAdmin: true,
      role: "superadmin",
      createdAt: new Date(),
    };

    const created = await createUser(superadmin);
    if (created) {
      console.log("Initial superadmin account created successfully");
    } else {
      console.error("Failed to create initial superadmin account");
    }
  } catch (error) {
    console.error(
      "Error creating superadmin:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ======= User management functions =======
export async function findUserByUsername(
  username: string
): Promise<User | null> {
  try {
    const db = await initKV();
    if (db === null) {
      // Use in-memory storage
      const key = `users:${username}`;
      return memoryStorage.get(key) || null;
    }
    const result = await db.get<User>(["users", username]);
    return result.value;
  } catch (error) {
    console.error(
      "Error finding user:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function createUser(user: User): Promise<boolean> {
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

    // Store user
    if (db === null) {
      // Use in-memory storage
      const key = `users:${user.username}`;
      memoryStorage.set(key, newUser);
    } else {
      // Use KV database
      await db.set(["users", user.username], newUser);
    }

    console.log("User created successfully:", user.username);
    return true;
  } catch (error) {
    console.error(
      "Error creating user:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

export async function updateUser(user: User): Promise<boolean> {
  try {
    const db = await initKV();

    if (db === null) {
      // Use in-memory storage
      const key = `users:${user.username}`;
      memoryStorage.set(key, user);
    } else {
      // Use KV database
      await db.set(["users", user.username], user);
    }

    return true;
  } catch (error) {
    console.error(
      "Error updating user:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

export async function validateUser(
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
  } catch (error) {
    console.error(
      "Error validating user:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// ======= JWT functions =======
export async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    console.warn(
      "JWT_SECRET not set. Using default development key (NOT secure for production)"
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

export async function generateToken(user: User): Promise<string> {
  const key = await getJwtKey();

  const token = await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.username,
      exp: getNumericDate(60 * 60), // 1 hour expiration
      isAdmin: user.isAdmin,
      role: user.role,
    },
    key
  );

  return token;
}

export async function verifyToken(token: string): Promise<any> {
  try {
    const key = await getJwtKey();
    return await verify(token, key);
  } catch (error) {
    console.error(
      "Token verification error:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

function getNumericDate(exp: number): number {
  return Math.floor(Date.now() / 1000) + exp;
}

// ======= Invitation code functions =======
export async function generateInvitationCode(
  createdBy: string
): Promise<string | null> {
  try {
    // Verify creator is a superadmin
    const creator = await findUserByUsername(createdBy);
    if (!creator || creator.role !== "superadmin") {
      console.warn(
        `User ${createdBy} attempted to generate invitation code without superadmin privileges`
      );
      return null;
    }

    // Generate a secure random code
    const randomBytes = crypto.getRandomValues(new Uint8Array(24));
    const code = btoa(String.fromCharCode(...randomBytes))
      .replace(/[+/=]/g, "")
      .substring(0, 16);

    // Create invitation record
    const invitationCode: InvitationCode = {
      code,
      createdBy,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      isUsed: false,
    };

    // Store invitation
    const db = await initKV();
    if (db === null) {
      // Use in-memory storage
      memoryStorage.set(`invitation:${code}`, invitationCode);
    } else {
      // Use KV database
      await db.set(["invitations", code], invitationCode);
    }

    console.log(`Invitation code generated by ${createdBy}: ${code}`);
    return code;
  } catch (error) {
    console.error(
      "Error generating invitation code:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function verifyInvitationCode(
  code: string
): Promise<InvitationCode | null> {
  try {
    // Get the invitation
    const db = await initKV();
    let invitation: InvitationCode | null = null;

    if (db === null) {
      // Use in-memory storage
      invitation = memoryStorage.get(`invitation:${code}`) || null;
    } else {
      // Use KV database
      const result = await db.get<InvitationCode>(["invitations", code]);
      invitation = result.value;
    }

    if (!invitation) {
      console.warn(`Invalid invitation code attempted: ${code}`);
      return null;
    }

    // Check if already used
    if (invitation.isUsed) {
      console.warn(`Attempted to use already used invitation code: ${code}`);
      return null;
    }

    // Check if expired
    if (new Date() > new Date(invitation.expiresAt)) {
      console.warn(`Attempted to use expired invitation code: ${code}`);
      return null;
    }

    return invitation;
  } catch (error) {
    console.error(
      "Error verifying invitation code:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function markInvitationCodeAsUsed(
  code: string,
  usedBy: string
): Promise<boolean> {
  try {
    // Get the invitation
    const db = await initKV();
    let invitation: InvitationCode | null = null;

    if (db === null) {
      // Use in-memory storage
      invitation = memoryStorage.get(`invitation:${code}`) || null;
    } else {
      // Use KV database
      const result = await db.get<InvitationCode>(["invitations", code]);
      invitation = result.value;
    }

    if (!invitation) {
      return false;
    }

    // Update invitation
    const updatedInvitation: InvitationCode = {
      ...invitation,
      isUsed: true,
      usedBy,
      usedAt: new Date(),
    };

    // Store updated invitation
    if (db === null) {
      // Use in-memory storage
      memoryStorage.set(`invitation:${code}`, updatedInvitation);
    } else {
      // Use KV database
      await db.set(["invitations", code], updatedInvitation);
    }

    console.log(`Invitation code ${code} used by ${usedBy}`);
    return true;
  } catch (error) {
    console.error(
      "Error marking invitation as used:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// ======= Authentication middleware =======
export async function requireAuth(ctx: Context, next: Function): Promise<void> {
  // Get authorization header
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, error: "Authentication required" };
    return;
  }

  // Extract token
  const token = authHeader.split(" ")[1];

  // Verify token
  const payload = await verifyToken(token);
  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, error: "Invalid or expired token" };
    return;
  }

  // Set user info in state
  ctx.state.user = {
    username: payload.sub,
    isAdmin: payload.isAdmin,
    role: payload.role,
  };

  await next();
}

export async function requireAdmin(
  ctx: Context,
  next: Function
): Promise<void> {
  await requireAuth(ctx, async () => {
    if (!ctx.state.user.isAdmin) {
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        error: "Admin privileges required",
      };
      return;
    }

    await next();
  });
}

export async function requireSuperAdmin(
  ctx: Context,
  next: Function
): Promise<void> {
  await requireAuth(ctx, async () => {
    if (ctx.state.user.role !== "superadmin") {
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        error: "Superadmin privileges required",
      };
      return;
    }

    await next();
  });
}
