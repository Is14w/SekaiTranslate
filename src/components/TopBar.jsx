import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";
import { FiSettings, FiMenu } from "react-icons/fi";
import { BiLogIn } from "react-icons/bi";
import { BiUserPlus } from "react-icons/bi";
import "../styles/TopBar.css";
import Settings from "../pages/Settings";
import { useTheme } from "../contexts/ThemeContext";

function TopBar({ isMobile, onToggleSidebar }) {
  // GitHub repository URL
  const githubRepoUrl = "https://github.com/Is14w/SekaiTranslate";

  // 设置页面的显示状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 使用主题上下文
  const { theme } = useTheme();

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
          <motion.button className="action-button" whileTap={{ scale: 0.95 }}>
            <span className="button-text">登录</span>
            <BiLogIn className="button-icon" />
          </motion.button>
          <motion.button className="action-button" whileTap={{ scale: 0.95 }}>
            <span className="button-text">注册</span>
            <BiUserPlus className="button-icon" />
          </motion.button>
        </div>
      </motion.div>

      {/* 设置页面组件 */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}

export default React.memo(TopBar);
