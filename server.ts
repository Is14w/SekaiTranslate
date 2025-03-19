import {
  Application,
  Context,
  Next,
  Router,
  send,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/oakCors.ts";
import { load } from "https://deno.land/std@0.216.0/dotenv/mod.ts";

import {
  verifyTurnstileToken,
  findUserByUsername,
  createUser,
  updateUser,
  validateUser,
  generateToken,
  initKV,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  verifyToken,
  generateInvitationCode,
  verifyInvitationCode,
  markInvitationCodeAsUsed,
  listActiveInvitationCodes,
  deleteUserByUsername,
  User,
  InvitationCode,
} from "./backend/cmd/server/auth.ts";

import {
  getJsonFromKV,
  saveJsonToKV,
} from "./backend/cmd/server/jsonChunker.ts";

// Type definitions for request bodies
interface AuthRequest {
  username: string;
  password: string;
  turnstileToken: string;
}

interface AdminVerifyRequest {
  invitationCode: string;
}

interface GenerateInviteRequest {
  reason?: string;
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
      role: "user", // Default role
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

// Protected user profile endpoint
router.get("/api/user/profile", requireAuth, async (ctx: Context) => {
  try {
    const { username } = ctx.state.user;
    const user = await findUserByUsername(username);

    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, error: "User not found" };
      return;
    }

    // Return user info excluding password
    const { password, ...userInfo } = user;
    ctx.response.body = {
      success: true,
      user: userInfo,
    };
  } catch (error) {
    console.error(
      "Profile error:",
      error instanceof Error ? error.message : String(error)
    );
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

// Verify admin with invitation code
router.post("/api/auth/verify-admin", requireAuth, async (ctx: Context) => {
  try {
    // Get username from token
    const { username } = ctx.state.user;

    // Parse request body
    const result = ctx.request.body({ type: "json" });
    const body = (await result.value) as AdminVerifyRequest;

    // Validate that invitation code is present
    if (!body || !body.invitationCode) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Invitation code is required",
      };
      return;
    }

    // Verify the invitation code
    const invitation = await verifyInvitationCode(body.invitationCode);
    if (!invitation) {
      console.warn(
        `Invalid or expired invitation code attempt by user: ${username}`
      );
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        error: "Invalid or expired invitation code",
      };
      return;
    }

    // Verification passed, promote user to admin
    const user = await findUserByUsername(username);
    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, error: "User not found" };
      return;
    }

    // Check if user is already an admin
    if (user.isAdmin) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "User already has admin privileges",
        isAdmin: true,
      };
      return;
    }

    // Update user to be an admin
    const updatedUser: User = {
      ...user,
      isAdmin: true,
      role: "admin",
      invitedBy: invitation.createdBy,
    };

    // Save updated user
    const updated = await updateUser(updatedUser);
    if (!updated) {
      ctx.response.status = 500;
      ctx.response.body = { success: false, error: "Failed to update user" };
      return;
    }

    // Mark invitation code as used
    await markInvitationCodeAsUsed(body.invitationCode, username);

    // Generate a new token with admin privileges
    const newToken = await generateToken(updatedUser);

    console.log(
      `User ${username} has been promoted to admin via invitation code`
    );

    // Return success with new token
    ctx.response.body = {
      success: true,
      message: "Admin verification successful",
      token: newToken,
      isAdmin: true,
      role: "admin",
    };
  } catch (error) {
    console.error(
      "Admin verification error:",
      error instanceof Error ? error.message : String(error)
    );
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: "Internal server error" };
  }
});

router.get(
  "/api/admin/invitations",
  requireSuperAdmin,
  async (ctx: Context) => {
    try {
      // Get active invitation codes
      const invitations = await listActiveInvitationCodes();

      // Return the list of active invitation codes
      ctx.response.body = {
        success: true,
        invitations,
        count: invitations.length,
        message:
          invitations.length > 0
            ? "Active invitation codes retrieved successfully"
            : "No active invitation codes found",
      };
    } catch (error) {
      console.error(
        "Invitation listing error:",
        error instanceof Error ? error.message : String(error)
      );
      ctx.response.status = 500;
      ctx.response.body = { success: false, error: "Internal server error" };
    }
  }
);

router.post("/api/save-json", requireAdmin, async (ctx: Context) => {
  try {
    // 解析请求体
    const result = ctx.request.body({ type: "json" });
    const { filename, data } = await result.value;

    // 验证请求数据
    if (!filename || !data) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "文件名和数据必须提供",
      };
      return;
    }

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 提取文件名（去掉.json后缀）作为键
    const key = filename.replace(/\.json$/, "");

    // 记录修改日志
    const { username } = ctx.state.user;
    const logEntry = {
      timestamp: new Date(),
      user: username,
      filename: filename,
      action: "update",
    };

    // 使用jsonChunker保存数据
    const saveResult = await saveJsonToKV(db, key, data);

    // 保存日志
    await db.set(["json_logs", crypto.randomUUID()], logEntry);

    // 记录到控制台
    if (saveResult.chunked) {
      console.log(
        `用户 ${username} 更新了JSON数据: ${filename} (分块处理: ${saveResult.chunks}块)`
      );
    } else {
      console.log(`用户 ${username} 更新了JSON数据: ${filename}`);
    }

    ctx.response.body = {
      success: true,
      message: saveResult.chunked
        ? `数据保存成功 (大文件，已分为${saveResult.chunks}块存储)`
        : "数据保存成功",
      chunked: saveResult.chunked,
      chunks: saveResult.chunks,
    };
  } catch (error) {
    console.error("保存JSON数据时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 获取所有表格列表
router.get("/api/tables", async (ctx) => {
  try {
    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 从KV获取所有JSON数据的键
    const tables = [];
    const iterator = db.list({ prefix: ["json_data"] });

    for await (const entry of iterator) {
      tables.push({
        id: entry.key[1], // 使用键作为ID
        name: entry.key[1], // 使用键作为展示名称
      });
    }

    ctx.response.body = {
      success: true,
      tables: tables,
    };
  } catch (error) {
    console.error("获取表格列表时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 修改 "/api/table/:tableName" GET 路由
router.get("/api/table/:tableName", async (ctx) => {
  try {
    // 获取表名参数
    const { tableName } = ctx.params;
    if (!tableName) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "表名参数必须提供",
      };
      return;
    }

    console.log(`处理表格数据请求: ${tableName}`);

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    try {
      // 从KV获取数据
      console.log(`从KV获取表格: ${tableName}`);
      const data = await getJsonFromKV(db, tableName);

      if (data) {
        console.log(`成功从KV获取表格数据: ${tableName}`);

        // 确保返回的数据是正确的格式
        if (typeof data === "object" && data !== null) {
          const keys = Object.keys(data);

          if (keys.length === 1 && Array.isArray(data[keys[0]])) {
            // 已经是正确的格式: { "表名": [...] }
            console.log(
              `数据格式正确: { ${keys[0]}: Array[${data[keys[0]].length}] }`
            );
            ctx.response.body = { success: true, data };
            return;
          } else if (Array.isArray(data)) {
            // 数据是数组，需要包装
            console.log(`数据是数组，包装为 { "${tableName}": [...] } 格式`);
            ctx.response.body = {
              success: true,
              data: { [tableName]: data },
            };
            return;
          } else {
            // 数据是对象，但不符合预期格式
            console.warn(`数据格式异常，尝试转换...`);

            // 尝试在数据中查找数组形式的属性
            let foundArray = false;
            for (const [key, value] of Object.entries(data)) {
              if (Array.isArray(value)) {
                console.log(`找到数组属性 "${key}"，使用它作为主数据`);
                ctx.response.body = {
                  success: true,
                  data: { [key]: value },
                };
                foundArray = true;
                return;
              }
            }

            if (!foundArray) {
              // 无法找到数组，创建包含此对象的新结构
              console.warn(`无法找到数组属性，将对象包装为表格数据`);
              ctx.response.body = {
                success: true,
                data: { [tableName]: [data] }, // 将整个对象作为单条记录
              };
              return;
            }
          }
        } else {
          // 数据不是对象
          console.error(`无效数据类型: ${typeof data}`);
          ctx.response.body = {
            success: true,
            data: { [tableName]: [] }, // 返回空数组
          };
          return;
        }
      }

      // 如果KV中没有找到数据或格式处理失败，尝试从文件系统读取
      console.log(`尝试从文件系统读取: ${tableName}.json`);
      const filePath = `./public/assets/${tableName}.json`;
      const fileContent = await Deno.readTextFile(filePath);
      const jsonData = JSON.parse(fileContent);

      // 保存到KV中
      await saveJsonToKV(db, tableName, jsonData);

      ctx.response.body = {
        success: true,
        data: jsonData,
      };
    } catch (error) {
      console.error(`处理表格数据出错:`, error);
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `找不到表格数据: ${tableName}`,
        error: error.message,
      };
    }
  } catch (error) {
    console.error("获取表格数据时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 保存表格数据
router.post("/api/table/:tableName", requireAuth, async (ctx) => {
  try {
    // 获取表名参数
    const { tableName } = ctx.params;
    if (!tableName) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "表名参数必须提供",
      };
      return;
    }

    // 验证用户权限
    if (!ctx.state.user.isAdmin) {
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        message: "只有管理员可以保存数据",
      };
      return;
    }

    // 解析请求体
    const result = ctx.request.body({ type: "json" });
    const body = await result.value;

    // 验证数据
    if (!body || !body.data) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "表格数据必须提供",
      };
      return;
    }

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 记录修改日志
    const { username } = ctx.state.user;
    const logEntry = {
      timestamp: new Date(),
      user: username,
      tableName: tableName,
      action: "update",
    };

    // 事务操作：同时保存数据和日志
    const txnResult = await db
      .atomic()
      .set(["json_data", tableName], body.data)
      .set(["json_logs", crypto.randomUUID()], logEntry)
      .commit();

    if (!txnResult.ok) {
      throw new Error("数据库事务失败");
    }

    // 记录到控制台
    console.log(`用户 ${username} 更新了表格数据: ${tableName}`);

    ctx.response.body = {
      success: true,
      message: "表格数据保存成功",
    };
  } catch (error) {
    console.error("保存表格数据时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 创建新表格
router.post("/api/create-table", requireAdmin, async (ctx) => {
  try {
    // 解析请求体
    const result = ctx.request.body({ type: "json" });
    const { tableName, schema } = await result.value;

    // 验证数据
    if (!tableName) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "表格名称必须提供",
      };
      return;
    }

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 检查表格是否已存在
    const existingTable = await db.get(["json_data", tableName]);
    if (existingTable.value) {
      ctx.response.status = 409;
      ctx.response.body = {
        success: false,
        message: "同名表格已存在",
      };
      return;
    }

    // 创建空表格，或使用提供的schema作为模板
    const emptyTable = schema || [];

    // 保存到数据库
    await db.set(["json_data", tableName], emptyTable);

    // 记录日志
    const { username } = ctx.state.user;
    const logEntry = {
      timestamp: new Date(),
      user: username,
      tableName: tableName,
      action: "create",
    };
    await db.set(["json_logs", crypto.randomUUID()], logEntry);

    // 记录到控制台
    console.log(`用户 ${username} 创建了新表格: ${tableName}`);

    ctx.response.body = {
      success: true,
      message: "表格创建成功",
      tableName: tableName,
    };
  } catch (error) {
    console.error("创建表格时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 删除表格
router.delete("/api/table/:tableName", requireAdmin, async (ctx) => {
  try {
    // 获取表名参数
    const { tableName } = ctx.params;
    if (!tableName) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "表名参数必须提供",
      };
      return;
    }

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 检查表格是否存在
    const existingTable = await db.get(["json_data", tableName]);
    if (!existingTable.value) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "表格不存在",
      };
      return;
    }

    // 删除表格
    await db.delete(["json_data", tableName]);

    // 记录日志
    const { username } = ctx.state.user;
    const logEntry = {
      timestamp: new Date(),
      user: username,
      tableName: tableName,
      action: "delete",
    };
    await db.set(["json_logs", crypto.randomUUID()], logEntry);

    // 记录到控制台
    console.log(`用户 ${username} 删除了表格: ${tableName}`);

    ctx.response.body = {
      success: true,
      message: "表格删除成功",
    };
  } catch (error) {
    console.error("删除表格时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

router.get("/api/json-logs", requireAdmin, async (ctx: Context) => {
  try {
    // 获取查询参数
    const url = new URL(ctx.request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const filename = url.searchParams.get("filename");

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 从KV获取日志
    const logs = [];
    const iterator = db.list({ prefix: ["json_logs"] });

    // 收集所有日志
    for await (const entry of iterator) {
      if (!filename || entry.value.filename === filename) {
        logs.push(entry.value);
      }

      // 达到限制数量时停止
      if (logs.length >= limit) break;
    }

    // 按时间排序，最新的在前
    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    ctx.response.body = {
      success: true,
      logs: logs.slice(0, limit),
      total: logs.length,
    };
  } catch (error) {
    console.error("获取JSON日志时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

router.get("/api/get-json/:filename", async (ctx: Context) => {
  try {
    // 获取文件名参数
    const { filename } = ctx.params;
    if (!filename) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "文件名参数必须提供",
      };
      return;
    }

    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 提取文件名（去掉.json后缀）作为键
    const key = filename.replace(/\.json$/, "");

    try {
      // 使用jsonChunker从KV获取数据
      const data = await getJsonFromKV(db, key);

      if (data) {
        ctx.response.body = {
          success: true,
          data: data,
        };
        return;
      } else {
        ctx.response.status = 404;
        ctx.response.body = {
          success: false,
          message: `找不到数据: ${filename}`,
        };
      }
    } catch (error) {
      console.error(`获取JSON数据失败 ${filename}:`, error);
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `找不到数据: ${filename}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    console.error("获取JSON数据时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

// 添加获取JSON文件列表的接口
router.get("/api/list-json", async (ctx: Context) => {
  try {
    // 获取 KV 数据库连接
    const db = await initKV();
    if (db === null) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "数据库连接失败",
      };
      return;
    }

    // 从KV获取所有JSON数据的键
    const jsonFiles = [];
    const iterator = db.list({ prefix: ["json_data"] });
    for await (const entry of iterator) {
      jsonFiles.push({
        key: entry.key[1], // 第二部分是实际的文件名键
        filename: `${entry.key[1]}.json`,
      });
    }

    // 如果KV中没有数据，尝试从文件系统获取
    if (jsonFiles.length === 0) {
      try {
        const files = [];
        for await (const dirEntry of Deno.readDir("./public/assets")) {
          if (dirEntry.isFile && dirEntry.name.endsWith(".json")) {
            files.push({
              key: dirEntry.name.replace(/\.json$/, ""),
              filename: dirEntry.name,
            });
          }
        }
        ctx.response.body = {
          success: true,
          files: files,
        };
        return;
      } catch (fileError) {
        // 忽略文件系统错误，继续返回空列表
      }
    }

    ctx.response.body = {
      success: true,
      files: jsonFiles,
    };
  } catch (error) {
    console.error("列出JSON文件时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "未知错误",
    };
  }
});

router.delete(
  "/api/admin/users/:username",
  requireSuperAdmin,
  async (ctx: Context) => {
    try {
      // Get username parameter from URL
      const { username } = ctx.params;

      if (!username) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          error: "Username parameter is required",
        };
        return;
      }

      // Get current user from auth middleware
      const currentUser = ctx.state.user;

      // Prevent superadmin from deleting themselves
      if (username === currentUser.username) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          error: "Cannot delete your own account",
        };
        return;
      }

      // Attempt to delete the user
      const deleted = await deleteUserByUsername(username);

      if (deleted) {
        ctx.response.body = {
          success: true,
          message: `User ${username} has been deleted successfully`,
        };
      } else {
        ctx.response.status = 404;
        ctx.response.body = {
          success: false,
          error: `User ${username} not found or could not be deleted`,
        };
      }
    } catch (error) {
      console.error(
        "User deletion error:",
        error instanceof Error ? error.message : String(error)
      );
      ctx.response.status = 500;
      ctx.response.body = { success: false, error: "Internal server error" };
    }
  }
);

// Generate invitation code (superadmin only)
router.post(
  "/api/admin/generate-invite",
  requireSuperAdmin,
  async (ctx: Context) => {
    try {
      // Get superadmin username
      const { username } = ctx.state.user;

      // Generate a new invitation code
      const code = await generateInvitationCode(username);
      if (!code) {
        ctx.response.status = 500;
        ctx.response.body = {
          success: false,
          error: "Failed to generate invitation code",
        };
        return;
      }

      // Return the generated code
      ctx.response.body = {
        success: true,
        code,
        expiresIn: "24 hours",
        message: "Invitation code generated successfully",
      };
    } catch (error) {
      console.error(
        "Invitation generation error:",
        error instanceof Error ? error.message : String(error)
      );
      ctx.response.status = 500;
      ctx.response.body = { success: false, error: "Internal server error" };
    }
  }
);

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
