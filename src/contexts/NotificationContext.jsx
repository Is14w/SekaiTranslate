import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheckCircle, FiAlertCircle, FiXCircle } from "react-icons/fi";
import { useTheme } from "./ThemeContext.jsx";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const [topBarHeight, setTopBarHeight] = useState(50); // 默认高度
  const resizeObserverRef = useRef(null);

  // 动态监测 TopBar 的高度
  useEffect(() => {
    const updateTopBarHeight = () => {
      const topBar = document.querySelector(".topbar");
      if (topBar) {
        setTopBarHeight(topBar.offsetHeight);
      }
    };

    // 初始运行
    updateTopBarHeight();

    // 使用 ResizeObserver 监听 TopBar 高度变化
    if (typeof ResizeObserver !== "undefined") {
      const topBar = document.querySelector(".topbar");
      if (topBar && !resizeObserverRef.current) {
        const observer = new ResizeObserver(() => {
          updateTopBarHeight();
        });
        observer.observe(topBar);
        resizeObserverRef.current = observer;
      }
    }

    // 备用方案：窗口大小改变时重新计算
    window.addEventListener("resize", updateTopBarHeight);

    // 清理函数
    return () => {
      window.removeEventListener("resize", updateTopBarHeight);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, []);

  // Add a new notification
  const showNotification = (message, type = "success", duration = 3000) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type, duration }]);

    // Auto-remove notification after duration
    setTimeout(() => {
      removeNotification(id);
    }, duration);

    return id;
  };

  // Remove notification by id
  const removeNotification = (id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  };

  // Helper methods for common notifications
  const showSuccess = (message) => showNotification(message, "success", 3000);
  const showError = (message) => showNotification(message, "error", 4500);
  const showInfo = (message) => showNotification(message, "info", 3000);

  // Get appropriate icon based on notification type
  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <FiCheckCircle className="text-green-500" size={18} />;
      case "error":
        return <FiXCircle className="text-red-500" size={18} />;
      default:
        return <FiAlertCircle className="text-blue-500" size={18} />;
    }
  };

  // Get appropriate background color based on type and theme
  const getBackgroundColor = (type) => {
    if (isDarkMode) {
      switch (type) {
        case "success":
          return "bg-green-900/30";
        case "error":
          return "bg-red-900/30";
        default:
          return "bg-blue-900/30";
      }
    } else {
      switch (type) {
        case "success":
          return "bg-green-100";
        case "error":
          return "bg-red-100";
        default:
          return "bg-blue-100";
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{ showNotification, showSuccess, showError, showInfo }}
    >
      {children}

      {/* Notification container - 修改为位于右下角 */}
      <div
        className="fixed right-4 z-50 flex flex-col gap-2 items-end pointer-events-none"
        style={{ top: `${topBarHeight + 12}px` }} // 添加 12px 的顶部边距
      >
        <AnimatePresence>
          {notifications.map(({ id, message, type }) => (
            <motion.div
              key={id}
              className={`${getBackgroundColor(type)} ${
                isDarkMode ? "text-white" : "text-gray-800"
              } px-4 py-3 rounded-md shadow-md flex items-center pointer-events-auto max-w-xs w-full`}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mr-2 flex-shrink-0">{getIcon(type)}</div>
              <span className="flex-1 text-sm">{message}</span>
              <button
                onClick={() => removeNotification(id)}
                className={`ml-2 p-1 rounded-full hover:bg-black/10 flex-shrink-0 ${
                  isDarkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <FiXCircle size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
