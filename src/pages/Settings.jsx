import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IoMdClose, IoMdRefresh } from "react-icons/io";
import {
  FiLock,
  FiCheck,
  FiShield,
  FiCopy,
  FiAlertTriangle,
} from "react-icons/fi";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useUser } from "../contexts/UserContext.jsx";

// 移除 React Router 相关导入
// import { useNavigate, Routes, Route, Link, useLocation } from "react-router-dom";

// Utility to get API base URL based on environment
const getConfig = () => {
  const host = window.location.hostname;
  const isDev = host === "localhost" || host === "127.0.0.1";
  return {
    apiBaseUrl: isDev ? "" : "https://sekai-translate.deno.dev",
  };
};

// Tab component for navigation
function SettingsTab({ active, name, label, onClick, icon }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  return (
    <button
      onClick={() => onClick(name)}
      className={`flex items-center px-4 py-2 rounded-md transition-colors ${
        active === name
          ? isDarkMode
            ? "bg-[#3a3a3a] text-[#62c7bf]"
            : "bg-[#e6f7f5] text-[#62c7bf]"
          : isDarkMode
          ? "text-gray-400 hover:bg-[#2a2a2a]"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </button>
  );
}

// 常规设置面板
function GeneralSettings() {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === "dark";

  return (
    <div>
      <h3 className="text-lg font-medium mb-3">显示设置</h3>
      <div className="flex items-center justify-between mb-6">
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
          版本: 0.1.3
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
  );
}

// 管理员验证面板
function AdminSettings() {
  const { theme } = useTheme();
  const { user, login } = useUser();
  const isDarkMode = theme === "dark";
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { apiBaseUrl } = getConfig();

  const handleVerifyInvitation = async () => {
    if (!invitationCode.trim()) {
      setError("请输入邀请码");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("未登录");
      }

      const response = await fetch(`${apiBaseUrl}/api/auth/verify-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invitationCode }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);

        // Update local storage and context with new token and user info
        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        // Update user context
        const updatedUser = {
          ...user,
          isAdmin: true,
          role: data.role || "admin",
        };

        // Update local storage
        localStorage.setItem("user", JSON.stringify(updatedUser));

        // Update user context
        login(updatedUser, data.token || localStorage.getItem("token"));
      } else {
        setError(data.error || "验证失败，请确认邀请码是否正确");
      }
    } catch (err) {
      console.error("邀请码验证错误:", err);
      setError("网络错误，请检查连接");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!user) {
    return (
      <div
        className={`p-4 rounded-md ${
          isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
        }`}
      >
        <div className="flex items-center text-yellow-500 mb-2">
          <FiAlertTriangle size={18} />
          <span className="ml-2">需要登录才能使用此功能</span>
        </div>
        <p
          className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          请先登录以获取管理员权限
        </p>
      </div>
    );
  }

  if (user.isAdmin) {
    return (
      <div
        className={`p-4 rounded-md ${
          isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
        }`}
      >
        <div className="flex items-center text-green-500 mb-2">
          <FiShield size={18} />
          <span className="ml-2">您已拥有管理员权限</span>
        </div>
        <p
          className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          角色: {user.role === "superadmin" ? "超级管理员" : "管理员"}
        </p>
        {user.invitedBy && (
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            邀请人: {user.invitedBy}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-3">管理员权限</h3>
      <div
        className={`p-4 rounded-md ${
          isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
        }`}
      >
        <p
          className={`text-sm mb-3 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          输入邀请码获取管理员权限
        </p>
        <div className="relative">
          <input
            type="text"
            value={invitationCode}
            onChange={(e) => setInvitationCode(e.target.value)}
            className={`w-full px-4 py-2 pr-10 rounded-md border ${
              isDarkMode
                ? "bg-[#333] border-gray-700 text-gray-200 focus:border-[#62c7bf]"
                : "bg-white border-gray-300 text-gray-800 focus:border-[#62c7bf]"
            } focus:outline-none focus:ring-1 focus:ring-[#62c7bf] transition-colors`}
            placeholder="请输入邀请码"
            disabled={isVerifying || success}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <FiLock size={18} className="text-gray-500" />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        {success && (
          <div className="flex items-center space-x-2 text-green-500 mt-2">
            <FiCheck size={18} />
            <span>验证成功！您已获得管理员权限</span>
          </div>
        )}

        <button
          onClick={handleVerifyInvitation}
          disabled={isVerifying || success || !invitationCode.trim()}
          className={`mt-3 w-full px-4 py-2 rounded-md transition-colors ${
            isDarkMode
              ? "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
              : "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
          } ${
            isVerifying || success || !invitationCode.trim()
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
      </div>
    </div>
  );
}

// 超级管理员面板
function SuperAdminSettings() {
  const { theme } = useTheme();
  const { user } = useUser();
  const isDarkMode = theme === "dark";
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const { apiBaseUrl } = getConfig();

  const generateInvitationCode = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedCode("");
    setCopySuccess(false);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("未登录");
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/generate-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success && data.code) {
        setGeneratedCode(data.code);
      } else {
        setError(data.error || "生成邀请码失败");
      }
    } catch (err) {
      console.error("邀请码生成错误:", err);
      setError("网络错误，请检查连接");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      () => {
        setError("复制到剪贴板失败");
      }
    );
  };

  // Check if user is a superadmin
  if (!user || user.role !== "superadmin") {
    return (
      <div
        className={`p-4 rounded-md ${
          isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
        }`}
      >
        <div className="flex items-center text-yellow-500 mb-2">
          <FiAlertTriangle size={18} />
          <span className="ml-2">需要超级管理员权限</span>
        </div>
        <p
          className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          此功能仅对超级管理员开放
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-3">邀请码管理</h3>
      <div
        className={`p-4 rounded-md ${
          isDarkMode ? "bg-[#2a2a2a]" : "bg-gray-100"
        }`}
      >
        <p
          className={`text-sm mb-3 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          生成新的邀请码以邀请管理员
        </p>

        <button
          onClick={generateInvitationCode}
          disabled={isGenerating}
          className={`w-full px-4 py-2 rounded-md transition-colors ${
            isDarkMode
              ? "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
              : "bg-[#62c7bf] hover:bg-[#58b2aa] text-white"
          } ${isGenerating ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isGenerating ? (
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
              生成中...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <IoMdRefresh size={18} className="mr-2" />
              生成新邀请码
            </span>
          )}
        </button>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        {generatedCode && (
          <div className="mt-4">
            <label
              className={`block text-sm font-medium mb-1 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              新生成的邀请码 (24小时内有效):
            </label>
            <div className="flex">
              <input
                type="text"
                value={generatedCode}
                readOnly
                className={`flex-grow px-3 py-2 rounded-l-md border ${
                  isDarkMode
                    ? "bg-[#333] border-gray-700 text-gray-200"
                    : "bg-white border-gray-300 text-gray-800"
                }`}
              />
              <button
                onClick={copyToClipboard}
                className={`px-3 py-2 rounded-r-md ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                }`}
                title="复制到剪贴板"
              >
                <FiCopy size={18} />
              </button>
            </div>
            {copySuccess && (
              <p className="text-green-500 text-sm mt-1">已复制到剪贴板</p>
            )}
            <p
              className={`text-sm mt-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              请妥善保管此邀请码，每个邀请码只能使用一次
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 主设置组件
function Settings({ isOpen, onClose }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  // 移除 React Router 相关 hooks
  // const navigate = useNavigate();
  // const location = useLocation();
  const [activeTab, setActiveTab] = useState("general");

  // 移除 URL 同步
  // useEffect(() => {
  //   // Extract tab from path, default to general
  //   const path = location.pathname;
  //   if (path.includes("/admin")) {
  //     setActiveTab("admin");
  //   } else if (path.includes("/superadmin")) {
  //     setActiveTab("superadmin");
  //   } else {
  //     setActiveTab("general");
  //   }
  // }, [location.pathname]);

  // 简化标签页切换逻辑
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // 移除导航
    // navigate(`/settings/${tab === "general" ? "" : tab}`);
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

        {/* 标签页导航 */}
        <div
          className={`px-5 pt-4 flex space-x-2 overflow-x-auto ${
            isDarkMode ? "border-gray-700" : "border-gray-300"
          }`}
        >
          <SettingsTab
            active={activeTab}
            name="general"
            label="常规"
            onClick={handleTabChange}
            icon={<FiCheck size={16} />}
          />
          <SettingsTab
            active={activeTab}
            name="admin"
            label="管理员"
            onClick={handleTabChange}
            icon={<FiLock size={16} />}
          />
          <SettingsTab
            active={activeTab}
            name="superadmin"
            label="超级管理员"
            onClick={handleTabChange}
            icon={<FiShield size={16} />}
          />
        </div>

        <div className="p-5">
          {/* 标签页内容 */}
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "admin" && <AdminSettings />}
          {activeTab === "superadmin" && <SuperAdminSettings />}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Settings;
