import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { BiLogIn, BiUserPlus } from "react-icons/bi";
import { useTheme } from "../contexts/ThemeContext";
import { Turnstile } from "@marsidev/react-turnstile";

function AuthModal({ isOpen, onClose, initialMode = "login" }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const turnstileRef = useRef(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const siteKey = "";

  // 重置表单数据
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFormData({
        username: "",
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setTurnstileToken(null);
      // 如果有验证码实例，重置它
      if (turnstileRef.current && turnstileRef.current.reset) {
        turnstileRef.current.reset();
      }
    }
  }, [isOpen, initialMode]);

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
      const apiEndpoint =
        mode === "login"
          ? "http://localhost:8080/api/auth/login"
          : "http://localhost:8080/api/auth/register";

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
        // 处理成功响应
        // ...
      } else {
        setError(data.error || "操作失败，请稍后重试");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("网络错误，请检查连接");
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
    setTurnstileToken(null);

    // 重置验证码
    if (turnstileRef.current && turnstileRef.current.reset) {
      turnstileRef.current.reset();
    }
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

              {/* Cloudflare Turnstile 验证码 */}
              <div className="mb-6 flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  sitekey={siteKey}
                  onVerify={setTurnstileToken}
                  theme={isDarkMode ? "dark" : "light"}
                  language="zh-CN"
                  refreshExpired="auto"
                  responseField={false}
                  className="mx-auto"
                />
              </div>

              <button
                type="submit"
                className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  isDarkMode
                    ? "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                    : "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                disabled={isLoading || !turnstileToken}
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
