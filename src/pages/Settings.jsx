import React from "react";
import { motion } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { useTheme } from "../contexts/ThemeContext";

function Settings({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === "dark";

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
