import {
  Application,
  Router,
  Context,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/oakCors.ts";
import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";

async function loadLocalEnv(key_type: string) {
  if (import.meta.main) {
    try {
      const env = await load({ envPath: "../.env" });

      if (key_type === "TURNSTILE_SECRET_KEY") {
        return env.TURNSTILE_SECRET_KEY;
      } else if (key_type === "TURNSTILE_SITE_KEY") {
        return env.TURNSTILE_SITE_KEY;
      }
    } catch (e) {
      console.warn("Unable to load .env file: ", e);
    }
  }
}

// 定义请求和响应接口
interface AuthRequest {
  username: string;
  password: string;
  turnstileToken: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

// 获取 Turnstile Secret Key
async function getSecretKey(): Promise<string> {
  const isDev = !Deno.env.get("DENO_DEPLOYMENT_ID");
  const secretKey = isDev
    ? (await loadLocalEnv("TURNSTILE_SECRET_KEY")) || ""
    : Deno.env.get("TURNSTILE_SECRET_KEY") || "";

  if (!secretKey) {
    console.warn(
      "Warning: TURNSTILE_SECRET_KEY is not set in environment variables"
    );
  }

  return secretKey;
}

async function getSiteKey(): Promise<string> {
  const isDev = !Deno.env.get("DENO_DEPLOYMENT_ID");
  const siteKey = isDev
    ? (await loadLocalEnv("TURNSTILE_SITE_KEY")) || ""
    : Deno.env.get("TURNSTILE_SITE_KEY") || "";

  if (!siteKey) {
    console.warn(
      "Warning: TURNSTILE_SITE_KEY is not set in environment variables"
    );
  }

  return siteKey;
}

// 验证 Turnstile 令牌
async function verifyTurnstileToken(token: string): Promise<boolean> {
  // 获取 Secret Key
  const secretKey = await getSecretKey();

  // 如果密钥为空，返回失败
  if (!secretKey) {
    return false;
  }

  try {
    // 准备请求数据
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);

    // 发送验证请求到 Cloudflare
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    // 解析响应
    const result = (await response.json()) as TurnstileResponse;
    return result.success;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

// 创建应用和路由
const app = new Application();
const router = new Router();

app.use(
  oakCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:1420", // Adding Vite's default port
      "https://sekai-translate.netlify.app",
      "https://sekai-translate.deno.dev", // Add your Deno Deploy URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
    credentials: true,
  })
);

router.get("/api/config", async (ctx: Context) => {
  const isDev = !Deno.env.get("DENO_DEPLOYMENT_ID");
  console.log("isDev:", isDev);

  let turnstileSiteKey = "";
  if (isDev) {
    turnstileSiteKey = await getSiteKey();
  } else {
    turnstileSiteKey = Deno.env.get("TURNSTILE_SITE_KEY") || "";
  }

  ctx.response.body = {
    turnstileSiteKey: turnstileSiteKey,
  };
});

const isDeploy = !!Deno.env.get("DENO_DEPLOYMENT_ID");
const PORT = parseInt(Deno.env.get("PORT") || "8000");

// Add this before app.listen
app.addEventListener("listen", ({ hostname, port, secure }) => {
    console.log(
        `🚀 Server running on ${secure ? "https://" : "http://"}${
            hostname ?? "localhost"
        }:${port}`
    );
    console.log(`Environment: ${isDeploy ? "Production" : "Development"}`);
});

router.get("/api/health", (ctx: Context) => {
  ctx.response.body = {
    status: "success",
    message: "Server is running!",
    environment: isDeploy ? "production" : "development",
    time: new Date().toISOString(),
    deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID") || "local",
  };
});

// 登录端点
router.post("/api/auth/login", async (ctx: Context) => {
  try {
    // 获取请求体 - 修复这里的语法
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "无效的请求格式" };
      return;
    }

    // 添加日志以帮助调试
    console.log("登录请求:", {
      username: body.username,
      passwordProvided: !!body.password,
      tokenProvided: !!body.turnstileToken,
    });

    // 验证 Turnstile 令牌
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = { error: "验证码验证失败" };
      return;
    }

    // 其余代码保持不变...
  } catch (error) {
    console.error("Login error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "服务器内部错误" };
  }
});

// 注册端点
router.post("/api/auth/register", async (ctx: Context) => {
  try {
    // 获取请求体 - 修复这里的语法
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AuthRequest;

    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "无效的请求格式" };
      return;
    }

    // 添加日志以帮助调试
    console.log("注册请求:", {
      username: body.username,
      passwordProvided: !!body.password,
      tokenProvided: !!body.turnstileToken,
    });

    // 验证 Turnstile 令牌
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = { error: "验证码验证失败" };
      return;
    }

    // 简单的模拟注册逻辑
    ctx.response.body = {
      success: true,
      message: "用户注册成功",
    };
  } catch (error) {
    console.error("Register error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "服务器内部错误" };
  }
});

router.post("/api/auth/verify-admin", async (ctx: Context) => {
  try {
    // 验证用户是否已登录
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "请先登录" };
      return;
    }

    // 从请求中获取JWT令牌
    const token = authHeader.split(" ")[1];

    // 获取请求体 - 修复这里的语法
    const result = ctx.request.body({ type: "json" });
    const body = await result.value;
    const { adminKey } = body;

    // 验证管理员密钥是否合法
    // 从环境变量获取管理员密钥（推荐）或硬编码用于测试
    const validAdminKey = Deno.env.get("ADMIN_KEY") || "admin-secret-key";

    if (adminKey === validAdminKey) {
      // 成功验证管理员密钥
      ctx.response.body = {
        success: true,
        message: "管理员权限验证成功",
      };
    } else {
      // 管理员密钥不正确
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        error: "管理员密钥不正确",
      };
    }
  } catch (error) {
    console.error("Admin verification error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "服务器内部错误",
    };
  }
});

// 添加路由
app.use(router.routes());
app.use(router.allowedMethods());

// 设置端口
const port = parseInt(Deno.env.get("PORT") || "8000");

// 导出 Deno Deploy 处理函数
const handler = app.handle.bind(app);
export default handler;

// 本地开发启动服务器
if (import.meta.main) {
  console.log(`Server starting on port ${port}`);
  await app.listen({ port });
}
