import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";
import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

// 类型定义
export interface User {
  username: string;
  password: string; // 存储的哈希密码
  isAdmin: boolean;
  createdAt: Date;
}

// 全局变量
let kv: Deno.Kv | null = null;

// ======= 密码工具函数 =======
export async function hashPassword(password: string): Promise<string> {
  // 生成随机盐值
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 将密码转换为字节
  const passwordBytes = new TextEncoder().encode(password);

  // 使用PBKDF2哈希密码
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

  // 组合盐值和密钥进行存储
  const result = new Uint8Array(salt.length + key.byteLength);
  result.set(salt, 0);
  result.set(new Uint8Array(key), salt.length);

  // 以base64格式返回
  return btoa(String.fromCharCode(...result));
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // 解码存储的哈希
    const hashData = Uint8Array.from(atob(storedHash), (c) => c.charCodeAt(0));

    // 提取盐值（前16字节）
    const salt = hashData.slice(0, 16);
    const storedKey = hashData.slice(16);

    // 使用相同的盐值哈希输入密码
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

    // 比较哈希输入与存储的哈希
    const newKey = new Uint8Array(key);

    // A/3> 检查长度是否匹配
    if (storedKey.length !== newKey.length) {
      return false;
    }

    // 比较每个字节
    for (let i = 0; i < storedKey.length; i++) {
      if (storedKey[i] !== newKey[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(
      "密码验证错误:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// ======= TURNSTILE 验证 =======
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    const turnstileSecretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecretKey) {
      console.error("TURNSTILE_SECRET_KEY 未在环境变量中设置");
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
      "Turnstile 验证错误:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// ======= 数据库函数 =======
export async function connectToKV(): Promise<Deno.Kv | null> {
  try {
    // 检查 Deno.openKv 是否可用
    if (typeof Deno.openKv !== "function") {
      console.warn("Deno KV API is not available. Using in-memory storage instead.");
      return null; // 返回 null，使用内存存储
    }

    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      return await Deno.openKv();
    } else {
      const kvUrl = Deno.env.get("KV_URL");
      if (!kvUrl) {
        console.warn("KV_URL is not set. Using in-memory storage instead.");
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
    console.warn("Using in-memory storage instead.");
    return null;
  }
}

// 内存存储作为备选方案
const memoryStorage = new Map<string, any>();

export async function initKV(): Promise<Deno.Kv | null> {
  if (!kv) {
    kv = await connectToKV();
    console.log("KV is ready");
  }
  return kv;
}

// ======= 用户管理函数 =======
export async function findUserByUsername(
  username: string
): Promise<User | null> {
  try {
    const db = await initKV();
    if (db === null) {
      // 使用内存存储
      const key = `users:${username}`;
      return memoryStorage.get(key) || null;
    }
    const result = await db.get<User>(["users", username]);
    return result.value;
  } catch (error) {
    console.error(
      "查找用户错误:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function createUser(user: User): Promise<boolean> {
  try {
    const db = await initKV();

    // 检查用户是否已存在
    const existingUser = await findUserByUsername(user.username);
    if (existingUser) {
      return false;
    }

    // 哈希密码
    const hashedPassword = await hashPassword(user.password);

    // 创建带哈希密码的新用户
    const newUser: User = {
      ...user,
      password: hashedPassword,
    };

    // 存储用户
    if (db === null) {
      // 使用内存存储
      const key = `users:${user.username}`;
      memoryStorage.set(key, newUser);
    } else {
      // 使用 KV 数据库
      await db.set(["users", user.username], newUser);
    }

    console.log("用户创建成功:", user.username);
    return true;
  } catch (error) {
    console.error(
      "创建用户错误:",
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

    // 验证密码
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "验证用户错误:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

// ======= JWT 函数 =======
async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    console.warn("JWT_SECRET 未设置。使用默认开发密钥（生产环境不安全）");
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
      exp: getNumericDate(60 * 60), // 1小时过期
      isAdmin: user.isAdmin,
    },
    key
  );

  return token;
}

function getNumericDate(exp: number): number {
  return Math.floor(Date.now() / 1000) + exp;
}
