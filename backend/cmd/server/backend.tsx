import {
  Application,
  Router,
  Context,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/oakCors.ts";
import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const app = new Application();
const router = new Router();

interface AuthRequest {
  username: string;
  password: string;
  turnstileToken: string;
}

if (!Deno.env.get("DENO_DEPLOYMENT_ID")) {
  // 仅在非部署环境中加载 .env 文件
  const config = await load();
  for (const [key, value] of Object.entries(config)) {
    if (!(key in Deno.env.toObject())) {
      Deno.env.set(key, value);
    }
  }
}

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
  } catch (error) {
    console.error("Turnstile 验证错误:", error);
    return false;
  }
}

// 连接到 Deno KV 数据库
async function connectToKV() {
  try {
    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      return await Deno.openKv();
    } else {
      const kv = await Deno.openKv(
        "https://api.deno.com/databases/ee4c87ab-67ef-42d3-8161-43f317881bc6/connect"
      );
      console.log("Successfully connected to KV database");
      return kv;
    }
  } catch (error) {
    console.error("Failed to connect to KV database:", error);
    throw error;
  }
}

// 全局 KV 连接
let kv: Deno.Kv | null = null;

// 初始化 KV 数据库连接
async function initKV() {
  if (!kv) {
    kv = await connectToKV();
  }
  console.log("Connected to KV database");
  return kv;
}

// 定义用户接口
interface User {
  username: string;
  password: string; // 存储哈希后的密码
  isAdmin: boolean;
  createdAt: Date;
}

async function getJwtKey(): Promise<CryptoKey> {
  const secret =
    Deno.env.get("JWT_SECRET") || "your-secret-key-for-development";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// 用户相关函数
async function findUserByUsername(username: string): Promise<User | null> {
  try {
    const db = await initKV();
    const result = await db.get<User>(["users", username]);
    return result.value;
  } catch (error) {
    console.error("查找用户错误:", error);
    return null;
  }
}

async function createUser(user: User): Promise<boolean> {
  try {
    const db = await initKV();
    // 检查用户是否已存在
    console.log(db, user.username);
    const existingUser = await findUserByUsername(user.username);
    if (existingUser) {
      return false;
    }

    // 哈希密码 - 修改调用方式
    const hashedPassword = await bcrypt.hash(user.password);

    // 创建新用户
    const newUser: User = {
      ...user,
      password: hashedPassword,
      createdAt: new Date(),
    };

    // 存储用户
    await db.set(["users", user.username], newUser);
    console.log("用户创建成功:", newUser.username);
    return true;
  } catch (error) {
    console.error("创建用户错误:", error);
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

    // 验证密码 - 修改调用方式
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("验证用户错误:", error);
    return null;
  }
}

async function generateToken(user: User): Promise<string> {
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

// Oak 辅助函数
function getNumericDate(exp: number): number {
  return Math.floor(Date.now() / 1000) + exp;
}

// 登录端点增强
router.post("/api/auth/login", async (ctx: Context) => {
  try {
    // 解析请求体
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "无效的请求格式" };
      return;
    }

    // 验证 Turnstile 令牌
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "验证码验证失败" };
      return;
    }

    // 验证用户凭据
    const user = await validateUser(body.username, body.password);
    if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { success: false, error: "用户名或密码错误" };
      return;
    }

    // 生成 JWT 令牌
    const token = await generateToken(user);

    // 返回令牌和用户信息（不包括密码）
    const { password, ...userInfo } = user;
    ctx.response.body = {
      success: true,
      token,
      user: userInfo,
      message: "登录成功",
    };
  } catch (error) {
    console.error("登录错误:", error);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "服务器内部错误" };
  }
});

// 增强注册端点
router.post("/api/auth/register", async (ctx: Context) => {
  try {
    // 解析请求体
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "无效的请求格式" };
      return;
    }

    // 验证 Turnstile 令牌
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, error: "验证码验证失败" };
      return;
    }

    // 用户名长度限制
    if (body.username.length < 3 || body.username.length > 20) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "用户名长度必须在3-20个字符之间",
      };
      return;
    }

    // 密码强度要求
    if (body.password.length < 6) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "密码长度必须至少为6个字符",
      };
      return;
    }

    // 创建新用户
    const newUser: User = {
      username: body.username,
      password: body.password, // 将在 createUser 函数中哈希
      isAdmin: false, // 默认非管理员
      createdAt: new Date(),
    };

    const created = await createUser(newUser);
    if (!created) {
      ctx.response.status = 409; // Conflict
      ctx.response.body = { success: false, error: "用户名已存在" };
      return;
    }

    ctx.response.body = {
      success: true,
      message: "用户注册成功",
    };
  } catch (error) {
    console.error("注册错误:", error);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "服务器内部错误" };
  }
});

app.use(oakCors()); // 启用 CORS
app.use(router.routes());
app.use(router.allowedMethods());

// 添加配置端点
router.get("/api/config", (ctx) => {
  ctx.response.body = {
    turnstileSiteKey: Deno.env.get("TURNSTILE_SITE_KEY") || "",
  };
});

// 初始化 KV 连接
await initKV();

// 导出应用实例
export default app;
