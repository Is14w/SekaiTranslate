import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaGithub } from "react-icons/fa";
import {
  FiSettings,
  FiMenu,
  FiUser,
  FiLogOut,
  FiEdit,
  FiAlertCircle,
} from "react-icons/fi";
import { BiLogIn } from "react-icons/bi";
import { BiUserPlus } from "react-icons/bi";
import "../../styles/TopBar.css";
import Settings from "../modals/Settings.jsx";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useUser } from "../../contexts/UserContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import AuthModal from "../modals/AuthModal.jsx";

// Create a new context for edit mode
export const EditModeContext = React.createContext({
  isEditMode: false,
  toggleEditMode: () => {},
});

// Custom hook for using edit mode
export const useEditMode = () => React.useContext(EditModeContext);

export const EditModeProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = () => {
    setIsEditMode((prev) => !prev);
  };

  return (
    <EditModeContext.Provider value={{ isEditMode, toggleEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
};

function TopBar({ isMobile, onToggleSidebar }) {
  // GitHub repository URL
  const githubRepoUrl = "https://github.com/Is14w/SekaiTranslate";

  // 设置页面的显示状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 认证模态窗口的显示状态和模式
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: "login", // 'login' or 'register'
  });

  // 登出确认对话框状态
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 使用主题上下文
  const { theme } = useTheme();

  // 使用用户上下文
  const { user, isLoggedIn, logout } = useUser();

  // 使用通知上下文
  const { showSuccess } = useNotification();

  // 使用编辑模式上下文
  const { isEditMode, toggleEditMode } = useEditMode();

  // 判断用户是否有管理员权限
  const isAdmin =
    isLoggedIn &&
    (user?.isAdmin || user?.role === "admin" || user?.role === "superadmin");

  // 打开登录模态窗口
  const openLoginModal = () => {
    setAuthModal({
      isOpen: true,
      mode: "login",
    });
  };

  // 打开注册模态窗口
  const openRegisterModal = () => {
    setAuthModal({
      isOpen: true,
      mode: "register",
    });
  };

  // 关闭认证模态窗口
  const closeAuthModal = () => {
    setAuthModal({
      ...authModal,
      isOpen: false,
    });
  };

  // 显示登出确认对话框
  const confirmLogout = () => {
    setShowLogoutConfirm(true);
  };

  // 取消登出
  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // 处理用户登出
  const handleLogout = () => {
    // 保存用户名用于通知消息
    const username = user?.username || "用户";

    // 执行登出
    logout();

    // 关闭确认对话框
    setShowLogoutConfirm(false);

    // 显示退出登录通知
    showSuccess(`${username}已成功退出登录`);

    // 如果在编辑模式，自动退出编辑模式
    if (isEditMode) {
      toggleEditMode();
    }
  };

  return (
    <>
      <motion.div
        className={`topbar ${isMobile ? "mobile" : ""} ${theme}-theme`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="topbar-left">
          {isMobile && (
            <motion.button
              className="sidebar-toggle-btn"
              onClick={onToggleSidebar}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle sidebar"
            >
              <FiMenu />
            </motion.button>
          )}
          <div className="topbar-title">
            <h2>
              <span className="app-logo">
                <span className="app-logo-text">
                  <span className="highlight">Sekai</span>
                  <span className="secondary">Translate</span>
                </span>
              </span>
            </h2>
          </div>
        </div>

        <div className="topbar-actions">
          {/* Add edit mode toggle button for admins */}
          {isAdmin && (
            <motion.button
              className={`action-button ${isEditMode ? "active" : ""}`}
              whileTap={{ scale: 0.95 }}
              onClick={toggleEditMode}
              title={isEditMode ? "退出编辑模式" : "进入编辑模式"}
            >
              <span className="button-text">
                {isEditMode ? "退出编辑" : "编辑模式"}
              </span>
              <FiEdit className="button-icon" />
            </motion.button>
          )}

          <motion.a
            className="action-button"
            href={githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.95 }}
          >
            <span className="button-text">访问源代码</span>
            <FaGithub className="button-icon" />
          </motion.a>

          <motion.button
            className="action-button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSettingsOpen(true)}
          >
            <span className="button-text">设置</span>
            <FiSettings className="button-icon" />
          </motion.button>

          {isLoggedIn ? (
            <>
              <motion.div
                className="action-button user-info"
                whileTap={{ scale: 0.95 }}
              >
                <span className="button-text">{user.username}</span>
                <FiUser className="button-icon" />
              </motion.div>

              <motion.button
                className="action-button"
                whileTap={{ scale: 0.95 }}
                onClick={confirmLogout} // 修改为显示确认对话框
              >
                <span className="button-text">登出</span>
                <FiLogOut className="button-icon" />
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                className="action-button"
                whileTap={{ scale: 0.95 }}
                onClick={openLoginModal}
              >
                <span className="button-text">登录</span>
                <BiLogIn className="button-icon" />
              </motion.button>

              <motion.button
                className="action-button"
                whileTap={{ scale: 0.95 }}
                onClick={openRegisterModal}
              >
                <span className="button-text">注册</span>
                <BiUserPlus className="button-icon" />
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* 设置页面组件 */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 认证模态窗口 */}
      <AuthModal
        isOpen={authModal.isOpen}
        onClose={closeAuthModal}
        initialMode={authModal.mode}
      />

      {/* 登出确认对话框 */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelLogout}
            />

            <motion.div
              className={`relative w-full max-w-sm p-6 rounded-lg shadow-xl ${
                theme === "dark"
                  ? "bg-[#1e1e1e] text-gray-200"
                  : "bg-white text-gray-800"
              }`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center mb-4 text-amber-500">
                <FiAlertCircle size={24} className="mr-2" />
                <h3 className="text-lg font-semibold">确认退出登录</h3>
              </div>

              <p
                className={`mb-6 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}
              >
                您确定要退出登录吗？
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  className={`px-4 py-2 rounded-md ${
                    theme === "dark"
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  onClick={cancelLogout}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  onClick={handleLogout}
                >
                  确认退出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default React.memo(TopBar);
