import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

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
function getSecretKey(): string {
  // 从环境变量获取密钥
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
  
  // 如果环境变量为空，输出警告
  if (!secretKey) {
    console.warn("警告: TURNSTILE_SECRET_KEY 环境变量未设置！验证可能会失败。");
  }
  
  return secretKey || "";
}

// 验证 Turnstile 令牌
async function verifyTurnstileToken(token: string): Promise<boolean> {
  // 获取 Secret Key
  const secretKey = getSecretKey();
  
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
    const result = await response.json() as TurnstileResponse;
    return result.success;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

// 创建应用和路由
const app = new Application();
const router = new Router();

app.use(oakCors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:5173", 
    "http://localhost:1420", // Adding Vite's default port
    "https://sekai-translate.netlify.app",
    "https://sekai-translate.deno.dev" // Add your Deno Deploy URL
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
  credentials: true,
}));

// 健康检查端点
router.get("/api/health", (ctx: Context) => {
  ctx.response.body = {
    status: "success",
    message: "Server is running!",
    time: new Date().toISOString(),
  };
});

// 登录端点
router.post("/api/auth/login", async (ctx: Context) => {
  try {
    // 获取请求体
    const body = await ctx.request.body({ type: "json" }).value as AuthRequest;
    
    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "无效的请求格式" };
      return;
    }
    
    // 验证 Turnstile 令牌
    const valid = await verifyTurnstileToken(body.turnstileToken);
    if (!valid) {
      ctx.response.status = 400;
      ctx.response.body = { error: "验证码验证失败" };
      return;
    }
    
    // 简单的模拟登录逻辑
    if (body.username === "test" && body.password === "password") {
      ctx.response.body = {
        success: true,
        token: "sample-token-123",
        user: {
          username: body.username,
          role: "user",
        },
      };
    } else {
      ctx.response.status = 401;
      ctx.response.body = { error: "用户名或密码错误" };
    }
  } catch (error) {
    console.error("Login error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "服务器内部错误" };
  }
});

// 注册端点
router.post("/api/auth/register", async (ctx: Context) => {
  try {
    // 获取请求体
    const body = await ctx.request.body({ type: "json" }).value as AuthRequest;
    
    // 验证请求数据
    if (!body.username || !body.password || !body.turnstileToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "无效的请求格式" };
      return;
    }
    
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