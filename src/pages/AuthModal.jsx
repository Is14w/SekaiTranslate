import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { BiLogIn, BiUserPlus } from "react-icons/bi";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useUser } from "../contexts/UserContext.jsx";
import { useNotification } from "../contexts/NotificationContext.jsx";

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
  const { login } = useUser();
  const { showSuccess, showError } = useNotification();

  // 新增引用以修复 DOM 错误
  const scriptLoaded = useRef(false);
  const turnstileWidgetId = useRef(null);
  const modalMounted = useRef(false);
  const cleanupInProgress = useRef(false);
  const turnstileRenderPromise = useRef(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [config, setConfig] = useState({
    turnstileSiteKey: "",
    apiBaseUrl: getBaseUrl(),
  });

  function getBaseUrl() {
    const host = window.location.hostname;
    const isDev =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    return isDev ? "http://localhost:8000" : "https://sekai-translate.deno.dev";
  }

  // 安全地获取 Turnstile 容器
  const getTurnstileContainer = useCallback(() => {
    if (!modalMounted.current) return null;
    return document.getElementById("turnstile-container");
  }, []);

  // 安全的 Turnstile 清理函数
  const cleanupTurnstile = useCallback(() => {
    // 防止并发清理
    if (cleanupInProgress.current) return;
    cleanupInProgress.current = true;

    try {
      // 获取并存储要清理的 widgetId，然后立即重置引用
      const widgetId = turnstileWidgetId.current;
      turnstileWidgetId.current = null;

      // 如果没有 widgetId 或 turnstile 未加载，直接退出
      if (!widgetId || !window.turnstile) {
        cleanupInProgress.current = false;
        return;
      }

      // 安全地移除 widget
      setTimeout(() => {
        try {
          if (window.turnstile) {
            window.turnstile.remove(widgetId);
          }
        } catch (e) {
          console.log("Turnstile 清理: Widget 可能已经被移除", e);
        } finally {
          cleanupInProgress.current = false;
        }
      }, 0);
    } catch (e) {
      console.error("Turnstile 清理错误:", e);
      cleanupInProgress.current = false;
    }

    // 立即清除 token
    setTurnstileToken(null);
  }, []);

  // 安全的重置 Turnstile Widget 函数
  const resetTurnstileWidget = useCallback(() => {
    // 检查是否可以重置
    if (
      !isOpen ||
      !modalMounted.current ||
      !config.turnstileSiteKey ||
      isConfigLoading
    ) {
      return;
    }

    // 确保任何正在进行的清理完成
    if (cleanupInProgress.current) {
      setTimeout(resetTurnstileWidget, 50);
      return;
    }

    // 先清理现有 widget
    cleanupTurnstile();

    // 延迟渲染，避免 React 渲染循环中的 DOM 冲突
    if (turnstileRenderPromise.current) {
      clearTimeout(turnstileRenderPromise.current);
    }

    turnstileRenderPromise.current = setTimeout(() => {
      // 再次检查状态
      if (!isOpen || !modalMounted.current) return;

      const container = getTurnstileContainer();
      if (!container || !window.turnstile) return;

      try {
        // 确保容器为空
        container.innerHTML = "";

        turnstileWidgetId.current = window.turnstile.render(container, {
          sitekey: config.turnstileSiteKey,
          callback: function (token) {
            if (modalMounted.current && isOpen) {
              console.log("Turnstile token 已接收");
              setTurnstileToken(token);
            }
          },
          theme: isDarkMode ? "dark" : "light",
          language: "zh-cn",
          "refresh-expired": "auto",
        });
      } catch (e) {
        console.error("渲染 Turnstile widget 错误:", e);
      }
    }, 150);
  }, [
    isOpen,
    config.turnstileSiteKey,
    isConfigLoading,
    isDarkMode,
    cleanupTurnstile,
    getTurnstileContainer,
  ]);

  // 获取配置数据
  const fetchConfig = useCallback(async () => {
    console.log(
      "fetchConfig called, isOpen:",
      isOpen,
      "modalMounted:",
      modalMounted.current
    );

    if (!isOpen || !modalMounted.current) {
      console.log("Skipping fetchConfig due to conditions not met");
      return null;
    }

    console.log("Setting isConfigLoading to true");
    setIsConfigLoading(true);

    try {
      const baseUrl = getBaseUrl();
      console.log("Fetching config from:", `${baseUrl}/api/config`);

      // Add timestamp to prevent caching
      const response = await fetch(`${baseUrl}/api/config?t=${Date.now()}`);
      console.log("Fetch response received:", response.status);

      if (!response.ok) {
        console.error(`HTTP error ${response.status} when fetching config`);
        throw new Error(`HTTP 错误 ${response.status}`);
      }

      // Get response as text first for debugging
      const responseText = await response.text();
      console.log("Raw response text:", responseText);

      // Then parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("Parsed config data:", data);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error("无效的服务器响应");
      }

      // Validate siteKey
      let siteKey = "";
      if (
        data &&
        typeof data.turnstileSiteKey === "string" &&
        data.turnstileSiteKey.trim() !== ""
      ) {
        siteKey = data.turnstileSiteKey;
        console.log("Valid siteKey received:", siteKey);
      } else {
        console.error("API 没有返回有效的 turnstileSiteKey:", data);
        if (modalMounted.current) {
          setError("验证组件配置错误，请联系管理员");
        }
      }

      // Only update the config when the component is still mounted
      if (modalMounted.current) {
        setConfig((prevConfig) => ({
          ...prevConfig,
          turnstileSiteKey: siteKey,
        }));
      }

      return data;
    } catch (error) {
      console.error("从 API 获取配置失败:", error);
      if (modalMounted.current) {
        setError("无法加载配置信息，请稍后再试");
      }
      return null;
    } finally {
      if (modalMounted.current) {
        console.log("Setting isConfigLoading to false");
        setIsConfigLoading(false);
      }
    }
  }, [isOpen]);

  // 处理 Turnstile 脚本加载
  const loadTurnstileScript = useCallback(() => {
    if (
      !isOpen ||
      !modalMounted.current ||
      isConfigLoading ||
      !config.turnstileSiteKey
    ) {
      return;
    }

    // 添加额外验证，确保 siteKey 不为空
    if (!config.turnstileSiteKey || config.turnstileSiteKey.trim() === "") {
      console.error("Turnstile siteKey is empty, cannot load script");
      setError("验证组件配置错误，请联系管理员");
      return;
    }

    if (!window.turnstile && !scriptLoaded.current) {
      console.log("Loading Turnstile script......");

      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (!modalMounted.current || !isOpen) return;

        console.log("Turnstile script loaded");
        scriptLoaded.current = true;

        // 延迟渲染以确保脚本完全初始化
        setTimeout(() => {
          if (modalMounted.current && isOpen) {
            resetTurnstileWidget();
          }
        }, 100);
      };

      script.onerror = (e) => {
        console.error("Error loading Turnstile script:", e);
        scriptLoaded.current = false;
      };

      document.head.appendChild(script);
    } else if (window.turnstile) {
      // 脚本已加载，直接重置 widget
      resetTurnstileWidget();
    }
  }, [isOpen, isConfigLoading, config.turnstileSiteKey, resetTurnstileWidget]);

  useEffect(() => {
    console.log("Modal lifecycle effect triggered, isOpen:", isOpen);

    if (isOpen) {
      // 设置模态框已挂载标志
      modalMounted.current = true;
      console.log("Modal mounted flag set to true");

      console.log("About to fetch config...");
      fetchConfig();
    }

    return () => {
      if (isOpen) {
        console.log("Modal unmount cleanup");
        // 组件卸载前设置标志
        modalMounted.current = false;
      }
    };
  }, [isOpen, fetchConfig]);

  // 监控配置变化并加载 Turnstile
  useEffect(() => {
    if (isOpen && !isConfigLoading && config.turnstileSiteKey) {
      loadTurnstileScript();
    }
  }, [isOpen, isConfigLoading, config.turnstileSiteKey, loadTurnstileScript]);

  // 监控模式变化
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // 更新显示状态和重置表单
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
    }
  }, [isOpen, mode]);

  // 组件卸载时完全清理
  useEffect(() => {
    return () => {
      // 设置卸载标志
      modalMounted.current = false;

      // 清理 Turnstile
      const widgetId = turnstileWidgetId.current;
      if (widgetId && window.turnstile) {
        try {
          turnstileWidgetId.current = null;
          window.turnstile.remove(widgetId);
        } catch (e) {
          console.log("组件卸载时清理 Turnstile:", e);
        }
      }

      // 清理任何未完成的操作
      if (turnstileRenderPromise.current) {
        clearTimeout(turnstileRenderPromise.current);
      }
    };
  }, []);

  // 表单处理函数
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // 切换登录/注册模式
  const switchMode = useCallback(() => {
    setMode(mode === "login" ? "register" : "login");
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);

    // 重置验证码
    setTimeout(() => {
      if (modalMounted.current && isOpen) {
        resetTurnstileWidget();
      }
    }, 100);
  }, [mode, isOpen, resetTurnstileWidget]);

  // 表单提交处理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // 表单验证
    if (mode === "register" && formData.password !== formData.confirmPassword) {
      setError("密码不匹配，请重新输入");
      return;
    }

    // 验证码检查
    if (!turnstileToken) {
      setError("请完成验证码验证");

      // 如果需要，重置验证码
      setTimeout(() => {
        if (modalMounted.current && isOpen) {
          resetTurnstileWidget();
        }
      }, 100);
      return;
    }

    setIsLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
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

      // 组件可能已卸载，先检查
      if (!modalMounted.current) return;

      if (data.success) {
        if (mode === "login") {
          // 使用上下文的 login 方法
          login(data.user, data.token);
          showSuccess(`欢迎回来，${data.user.username}！`);
          onClose(); // 关闭模态窗口
        } else {
          // 注册成功后切换到登录模式
          setMode("login");
          setFormData({
            username: formData.username,
            password: "",
            confirmPassword: "",
          });

          showSuccess("注册成功，请登录！");

          // 显示成功消息
          setError(null);

          // 重置验证码
          setTimeout(() => {
            if (modalMounted.current && isOpen) {
              resetTurnstileWidget();
            }
          }, 100);
        }
      } else {
        setError(data.error || "操作失败，请稍后重试");
        showError(data.error || "操作失败，请稍后重试");

        // 重置验证码
        setTimeout(() => {
          if (modalMounted.current && isOpen) {
            resetTurnstileWidget();
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error:", err);

      // 组件可能已卸载，先检查
      if (!modalMounted.current) return;

      setError("网络错误，请检查连接");
      showError("网络错误，请检查连接");

      // 重置验证码
      setTimeout(() => {
        if (modalMounted.current && isOpen) {
          resetTurnstileWidget();
        }
      }, 100);
    } finally {
      if (modalMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // 手动刷新验证码
  const refreshTurnstile = useCallback(() => {
    if (modalMounted.current && isOpen) {
      resetTurnstileWidget();
    }
  }, [isOpen, resetTurnstileWidget]);

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
                    className={`w-full px-4 py-2 pr-10 rounded-md border ${
                      isDarkMode
                        ? "bg-[#2a2a2a] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                        : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#62c7bf]"
                    } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                    placeholder="请输入密码"
                    required
                    disabled={isLoading}
                  />
                  {/* 确保只有这一个按钮用于切换密码可见性 */}
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      } focus:outline-none`}
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? (
                        <FiEyeOff className="h-5 w-5" />
                      ) : (
                        <FiEye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
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
                      className={`w-full px-4 py-2 pr-10 rounded-md border ${
                        isDarkMode
                          ? "bg-[#2a2a2a] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                          : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#62c7bf]"
                      } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                      placeholder="请再次输入密码"
                      required
                      disabled={isLoading}
                    />
                    {/* 确保只有这一个按钮用于切换确认密码可见性 */}
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        className={`text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        } focus:outline-none`}
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        disabled={isLoading}
                        aria-label={
                          showConfirmPassword ? "隐藏密码" : "显示密码"
                        }
                      >
                        {showConfirmPassword ? (
                          <FiEyeOff className="h-5 w-5" />
                        ) : (
                          <FiEye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Turnstile 验证码 */}
              <div className="mb-6 flex justify-center relative">
                {isConfigLoading ? (
                  <div className="text-center py-3">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <p className="mt-2 text-sm text-gray-500">
                      加载验证组件...
                    </p>
                  </div>
                ) : config.turnstileSiteKey ? (
                  <div
                    id="turnstile-container"
                    className="cf-turnstile mx-auto"
                  ></div>
                ) : (
                  <div className="text-center py-3 text-red-500">
                    无法加载验证组件，请刷新页面重试
                  </div>
                )}

                {/* 添加刷新按钮 */}
                {!isConfigLoading && config.turnstileSiteKey && (
                  <button
                    type="button"
                    onClick={refreshTurnstile}
                    className={`absolute bottom-0 right-0 text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    } hover:underline focus:outline-none`}
                  >
                    刷新验证码
                  </button>
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
