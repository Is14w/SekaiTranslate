package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "time"
    
    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
)

// Turnstile 响应结构
type TurnstileResponse struct {
    Success    bool     `json:"success"`
    ErrorCodes []string `json:"error-codes"`
}

func main() {
    // 创建 gin 引擎
    router := gin.Default()

    // 配置 CORS
    router.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    }))

    // API 路由组
    api := router.Group("/api")
    {
        // 健康检查端点
        api.GET("/health", func(c *gin.Context) {
            c.JSON(http.StatusOK, gin.H{
                "status":  "success",
                "message": "Server is running!",
                "time":    time.Now().Format(time.RFC3339),
            })
        })

        // 用户认证端点
        auth := api.Group("/auth")
        {
            auth.POST("/login", handleLogin)
            auth.POST("/register", handleRegister)
        }
    }

    // 启动服务器
    port := "8080"
    log.Printf("Server starting on port %s\n", port)
    if err := router.Run(":" + port); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

// 验证 Turnstile 令牌
func verifyTurnstileToken(token string) (bool, error) {
    // Cloudflare Turnstile 密钥 (替换为你自己的密钥)
    secretKey := "" // 替换为你的 Secret Key

    // 准备请求数据
    data := map[string]string{
        "secret":   secretKey,
        "response": token,
    }
    
    jsonData, err := json.Marshal(data)
    if err != nil {
        return false, err
    }

    // 发送验证请求到 Cloudflare
    resp, err := http.Post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        "application/json",
        bytes.NewBuffer(jsonData),
    )
    if err != nil {
        return false, err
    }
    defer resp.Body.Close()

    // 读取响应
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return false, err
    }

    // 解析响应
    var result TurnstileResponse
    if err := json.Unmarshal(body, &result); err != nil {
        return false, err
    }

    return result.Success, nil
}

// 处理登录
func handleLogin(c *gin.Context) {
    var loginReq struct {
        Username      string `json:"username" binding:"required"`
        Password      string `json:"password" binding:"required"`
        TurnstileToken string `json:"turnstileToken" binding:"required"`
    }

    if err := c.ShouldBindJSON(&loginReq); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
        return
    }

    // 验证 Turnstile 令牌
    valid, err := verifyTurnstileToken(loginReq.TurnstileToken)
    if err != nil {
        log.Printf("Turnstile verification error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "验证服务错误"})
        return
    }

    if !valid {
        c.JSON(http.StatusBadRequest, gin.H{"error": "验证码验证失败"})
        return
    }

    // 简单的模拟登录逻辑
    if loginReq.Username == "test" && loginReq.Password == "password" {
        c.JSON(http.StatusOK, gin.H{
            "success": true,
            "token":   "sample-token-123",
            "user": gin.H{
                "username": loginReq.Username,
                "role":     "user",
            },
        })
        return
    }

    c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
}

// 处理注册
func handleRegister(c *gin.Context) {
    var registerReq struct {
        Username      string `json:"username" binding:"required"`
        Password      string `json:"password" binding:"required"`
        TurnstileToken string `json:"turnstileToken" binding:"required"`
    }

    if err := c.ShouldBindJSON(&registerReq); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
        return
    }

    // 验证 Turnstile 令牌
    valid, err := verifyTurnstileToken(registerReq.TurnstileToken)
    if err != nil {
        log.Printf("Turnstile verification error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "验证服务错误"})
        return
    }

    if !valid {
        c.JSON(http.StatusBadRequest, gin.H{"error": "验证码验证失败"})
        return
    }

    // 简单的模拟注册逻辑
    c.JSON(http.StatusOK, gin.H{
        "success": true,
        "message": "用户注册成功",
    })
}