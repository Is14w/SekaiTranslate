import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { FiLock, FiCheck, FiShield } from "react-icons/fi";
import { useTheme } from "../contexts/ThemeContext.jsx";

const getConfig = () => {
  // 检测当前环境
  const host = window.location.hostname;
  const isDev = host === "localhost" || host === "127.0.0.1";

  return {
    apiBaseUrl: isDev ? "" : "https://sekai-translate.deno.dev",
  };
};

function Settings({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === "dark";
  const [adminKey, setAdminKey] = useState("");
  const [adminKeyError, setAdminKeyError] = useState(null);
  const [adminKeySuccess, setAdminKeySuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const { apiBaseUrl } = getConfig();

  // 从本地存储获取用户信息
  useEffect(() => {
    if (isOpen) {
      const storedUserInfo = localStorage.getItem("userInfo");
      if (storedUserInfo) {
        try {
          setUserInfo(JSON.parse(storedUserInfo));
        } catch (e) {
          console.error("无法解析用户信息", e);
        }
      }

      // 重置状态
      setAdminKey("");
      setAdminKeyError(null);
      setAdminKeySuccess(false);
    }
  }, [isOpen]);

  // 处理管理员私钥验证
  const handleAdminKeyVerify = async () => {
    if (!adminKey.trim()) {
      setAdminKeyError("请输入管理员密钥");
      return;
    }

    setIsVerifying(true);
    setAdminKeyError(null);
    setAdminKeySuccess(false);

    try {
      const token = localStorage.getItem("userToken");
      if (!token) {
        throw new Error("未登录");
      }

      const response = await fetch(`${apiBaseUrl}/api/auth/verify-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adminKey }),
      });

      const data = await response.json();

      if (data.success) {
        setAdminKeySuccess(true);
        // 更新本地存储的用户信息
        const updatedUserInfo = { ...userInfo, isAdmin: true };
        localStorage.setItem("userInfo", JSON.stringify(updatedUserInfo));
        setUserInfo(updatedUserInfo);
      } else {
        setAdminKeyError(data.error || "验证失败，请确认密钥是否正确");
      }
    } catch (err) {
      console.error("管理员验证错误:", err);
      setAdminKeyError("网络错误，请检查连接");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`${
          isDarkMode ? "bg-[#1e1e1e] text-gray-200" : "bg-white text-gray-800"
        } rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden`}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex justify-between items-center px-5 py-4 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-300"
          }`}
        >
          <h2 className="text-xl font-semibold">设置</h2>
          <button
            className={`p-1 rounded-full ${
              isDarkMode
                ? "text-gray-400 hover:text-white hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-200"
            }`}
            onClick={onClose}
          >
            <IoMdClose size={22} />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">显示设置</h3>
            <div className="flex items-center justify-between">
              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                深色模式
              </span>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isDarkMode ? "bg-[#62c7bf]" : "bg-gray-400"
                }`}
                onClick={toggleTheme}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 管理员验证区域 - 仅对已登录用户显示 */}
          {userInfo && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">管理员设置</h3>
              <div
                className={`p-4 rounded-md mb-3 ${
                  isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
                }`}
              >
                {userInfo.isAdmin ? (
                  <div className="flex items-center space-x-2 text-green-500">
                    <FiShield size={18} />
                    <span>您已具有管理员权限</span>
                  </div>
                ) : (
                  <>
                    <p
                      className={`text-sm mb-3 ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      输入管理员密钥以获取管理员权限
                    </p>
                    <div className="relative">
                      <input
                        type="password"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        className={`w-full px-4 py-2 pr-10 rounded-md border ${
                          isDarkMode
                            ? "bg-[#333] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                            : "bg-white border-gray-300 text-gray-800 focus:border-[#62c7bf]"
                        } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
                        placeholder="请输入管理员密钥"
                        disabled={isVerifying || adminKeySuccess}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <FiLock size={18} className="text-gray-500" />
                      </div>
                    </div>

                    {adminKeyError && (
                      <p className="text-red-500 text-sm mt-2">
                        {adminKeyError}
                      </p>
                    )}

                    {adminKeySuccess && (
                      <div className="flex items-center space-x-2 text-green-500 mt-2">
                        <FiCheck size={18} />
                        <span>验证成功！您已获得管理员权限</span>
                      </div>
                    )}

                    <button
                      onClick={handleAdminKeyVerify}
                      disabled={
                        isVerifying || adminKeySuccess || !adminKey.trim()
                      }
                      className={`mt-3 w-full px-4 py-2 rounded-md transition-colors ${
                        isDarkMode
                          ? "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                          : "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
                      } ${
                        isVerifying || adminKeySuccess || !adminKey.trim()
                          ? "opacity-70 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {isVerifying ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                          验证中...
                        </span>
                      ) : (
                        "验证管理员权限"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-3">应用信息</h3>
            <div
              className={`p-3 rounded-md ${
                isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
              }`}
            >
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                版本: 0.1.2
              </p>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                © 2025 Is14w
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Settings;
