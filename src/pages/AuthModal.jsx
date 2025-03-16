import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { BiLogIn, BiUserPlus } from "react-icons/bi";
import { useTheme } from "../contexts/ThemeContext.jsx";

function AuthModal({ isOpen, onClose, initialMode = "login" }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const scriptLoaded = useRef(false);
  const turnstileWidgetId = useRef(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  // 初始化配置状态 - 确保 turnstileSiteKey 始终是字符串
  const [config, setConfig] = useState({
    turnstileSiteKey: "",
    apiBaseUrl: getBaseUrl(),
  });

  // 根据当前环境确定基础 URL
  function getBaseUrl() {
    const host = window.location.hostname;
    const isDev = host === "localhost" || host === "127.0.0.1";
    return isDev ? "http://localhost:8000" : "https://sekai-translate.deno.dev";
  }

  const fetchConfig = async () => {
    setIsConfigLoading(true);
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/config`);

      if (!response.ok) {
        throw new Error(`HTTP 错误 ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched remote config:", data);

      // 增强的 siteKey 获取和验证
      let siteKey = "";
      if (
        data &&
        typeof data.turnstileSiteKey === "string" &&
        data.turnstileSiteKey.trim() !== ""
      ) {
        siteKey = data.turnstileSiteKey;
      } else if (data && data.turnstileSiteKey) {
        // 如果不是字符串但存在，尝试转换为字符串并记录问题
        console.warn("API returned non-string siteKey:", data.turnstileSiteKey);
        siteKey = String(data.turnstileSiteKey);
      } else {
        console.error("API did not return a valid turnstileSiteKey");
      }

      console.log("Using site key:", siteKey);

      // 更新本地配置状态
      setConfig((prevConfig) => ({
        ...prevConfig,
        turnstileSiteKey: siteKey,
      }));

      return data;
    } catch (error) {
      console.error("Failed to fetch config from API:", error);
      setError("无法加载配置信息，请稍后再试");
      return null;
    } finally {
      setIsConfigLoading(false);
    }
  };

  // 当模态窗口打开时，获取配置
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    // 每当 initialMode 变化时，更新内部的 mode 状态
    setMode(initialMode);
  }, [initialMode]);

  // A simpler approach to cleaning up Turnstile
  const cleanupTurnstile = () => {
    if (turnstileWidgetId.current && window.turnstile) {
      try {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      } catch (e) {
        console.error("Error removing Turnstile widget:", e);
      }
    }
    setTurnstileToken(null);
  };

  // 统一的函数来重置 Turnstile
  const resetTurnstileWidget = () => {
    cleanupTurnstile();
    
    // Only try to render if the container exists and config is loaded
    const container = document.getElementById("turnstile-container");
    if (container && window.turnstile && config.turnstileSiteKey && !isConfigLoading) {
      setTimeout(() => {
        try {
          // Create a globally consistent callback name
          window.turnstileCallback = (token) => {
            console.log("Turnstile token received");
            setTurnstileToken(token);
          };
          
          // Clear container first
          container.innerHTML = "";
          
          // Render new widget
          turnstileWidgetId.current = window.turnstile.render("#turnstile-container", {
            sitekey: config.turnstileSiteKey,
            callback: "turnstileCallback",
            theme: isDarkMode ? "dark" : "light",
            language: "zh-cn",
            'refresh-expired': "auto"
          });
          
          console.log("Turnstile widget rendered with ID:", turnstileWidgetId.current);
        } catch (e) {
          console.error("Error rendering Turnstile widget:", e);
        }
      }, 200); // Slightly longer delay to ensure DOM is ready
    }
  };

  // 加载 Turnstile 脚本
  useEffect(() => {
    // Modal is closed - clean up but don't remove script
    if (!isOpen) {
      cleanupTurnstile();
      return;
    }

    // If config is loading or missing site key, wait
    if (isConfigLoading || !config.turnstileSiteKey) {
      return;
    }

    // Define global callback for Turnstile
    window.turnstileCallback = (token) => {
      console.log("Turnstile token received");
      setTurnstileToken(token);
    };

    // Load the script if not already loaded
    if (!window.turnstile && !scriptLoaded.current) {
      console.log("Loading Turnstile script...");
      
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log("Turnstile script loaded successfully");
        scriptLoaded.current = true;
        resetTurnstileWidget();
      };

      script.onerror = (e) => {
        console.error("Error loading Turnstile script:", e);
        scriptLoaded.current = false;
      };

      document.head.appendChild(script);
    } else if (window.turnstile) {
      // Script already loaded - reset widget
      resetTurnstileWidget();
    }

    // Cleanup function
    return () => {
      // We'll do complete cleanup only on component unmount
    };
  }, [isOpen, isConfigLoading, config.turnstileSiteKey, isDarkMode]);

  // 组件卸载时的彻底清理
  useEffect(() => {
    return () => {
      // 彻底清理全局副作用
      delete window.turnstileCallback;
      cleanupTurnstile();
      scriptLoaded.current = false;

      // 移除脚本（只在组件完全卸载时）
      const script = document.getElementById("cf-turnstile-script");
      if (script) {
        script.remove();
      }
    };
  }, []);

  // 当模式改变时重置表单
  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: "",
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      
      // Reset Turnstile when mode changes (login/register)
      resetTurnstileWidget();
    }
  }, [isOpen, mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // 基本验证
    if (mode === "register" && formData.password !== formData.confirmPassword) {
      setError("密码不匹配，请重新输入");
      return;
    }

    // 验证码验证
    if (!turnstileToken) {
      setError("请完成验证码验证");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      // 根据环境使用不同的 API 基础路径
      const apiEndpoint = `${config.apiBaseUrl}${endpoint}`;
      console.log("发送请求到:", apiEndpoint);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          turnstileToken: turnstileToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (mode === "login") {
          // 存储用户信息和令牌
          localStorage.setItem("userToken", data.token);
          if (data.user) {
            localStorage.setItem("userInfo", JSON.stringify(data.user));
          }
          onClose(); // 关闭模态窗口
        } else {
          // 注册成功后切换到登录模式
          setMode("login");
          setFormData({
            username: formData.username,
            password: "",
            confirmPassword: "",
          });
          resetTurnstileWidget();
        }
      } else {
        setError(data.error || "操作失败，请稍后重试");
        // Reset Turnstile on error
        resetTurnstileWidget();
      }
    } catch (err) {
      console.error("Error:", err);
      setError("网络错误，请检查连接");
      resetTurnstileWidget();
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    
    // Reset Turnstile widget when switching modes
    resetTurnstileWidget();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className={`relative w-full max-w-md p-8 rounded-lg shadow-xl ${
              isDarkMode
                ? "bg-[#1e1e1e] text-gray-200"
                : "bg-white text-gray-800"
            }`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            {/* Rest of your UI */}
            <button
              className={`absolute top-4 right-4 p-1 rounded-full ${
                isDarkMode
                  ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-200"
              }`}
              onClick={onClose}
            >
              <FiX size={24} />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">
                <span
                  className={isDarkMode ? "text-[#62c7bf]" : "text-[#62c7bf]"}
                >
                  Sekai
                </span>
                <span
                  className={isDarkMode ? "text-[#e99bab]" : "text-[#e99bab]"}
                >
                  Translate
                </span>
              </h2>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {mode === "login" ? "欢迎回来，请登录您的账户" : "创建您的账户"}
              </p>
            </div>

            {error && (
              <div
                className={`mb-6 p-3 rounded-md ${
                  isDarkMode
                    ? "bg-red-900/30 text-red-200"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                  htmlFor="username"
                >
                  用户名
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-md border ${
                    isDarkMode
                      ? "bg-[#2a2a2a] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                      : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#62c7bf]"
                  } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                  placeholder="请输入用户名"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="mb-6">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                  htmlFor="password"
                >
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-md border ${
                      isDarkMode
                        ? "bg-[#2a2a2a] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                        : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#62c7bf]"
                    } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                    placeholder="请输入密码"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <FiEyeOff size={18} />
                    ) : (
                      <FiEye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="mb-6">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                    htmlFor="confirmPassword"
                  >
                    确认密码
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded-md border ${
                        isDarkMode
                          ? "bg-[#2a2a2a] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                          : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#62c7bf]"
                      } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                      placeholder="请再次输入密码"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <FiEyeOff size={18} />
                      ) : (
                        <FiEye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Cloudflare Turnstile 验证码 - 简化并改用显式渲染 */}
              <div className="mb-6 flex justify-center">
                {isConfigLoading ? (
                  <div className="text-center py-3">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <p className="mt-2 text-sm text-gray-500">
                      加载验证组件...
                    </p>
                  </div>
                ) : config.turnstileSiteKey ? (
                  <div id="turnstile-container" className="cf-turnstile mx-auto"></div>
                ) : (
                  <div className="text-center py-3 text-red-500">
                    无法加载验证组件，请刷新页面重试
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  isDarkMode
                    ? "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                    : "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                } ${
                  isLoading || !turnstileToken || isConfigLoading
                    ? "opacity-70 cursor-not-allowed"
                    : ""
                }`}
                disabled={isLoading || !turnstileToken || isConfigLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {mode === "login" ? "登录中..." : "注册中..."}
                  </>
                ) : (
                  <>
                    {mode === "login" ? (
                      <>
                        <BiLogIn size={20} />
                        <span>登录</span>
                      </>
                    ) : (
                      <>
                        <BiUserPlus size={20} />
                        <span>注册</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                {mode === "login" ? "还没有账户？" : "已有账户？"}{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className={`font-medium ${
                    isDarkMode
                      ? "text-[#62c7bf] hover:text-[#58b2aa]"
                      : "text-[#62c7bf] hover:text-[#58b2aa]"
                  }`}
                  disabled={isLoading}
                >
                  {mode === "login" ? "立即注册" : "立即登录"}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default React.memo(AuthModal);