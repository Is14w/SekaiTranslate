import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBook,
  FiSearch,
  FiUsers,
  FiDatabase,
  FiChevronDown,
  FiRefreshCw,
  FiPlus,
} from "react-icons/fi";
import "../styles/MobileSidebar.css";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useUser } from "../contexts/UserContext.jsx";
import { toast } from "react-toastify";
import { useEditMode } from "./TopBar.jsx";
import CreateTableButton from "./CreateTableButton.jsx";

const MobileSidebar = ({
  isOpen,
  onClose,
  selectedFunction,
  selectedTable,
  onFunctionSelect,
  onTableSelect,
  expandedMenus,
  onToggleMenu,
}) => {
  // 使用主题上下文
  const { theme } = useTheme();

  // 获取用户信息
  const { user } = useUser();
  // 判断是否为管理员
  const isAdmin = user?.isAdmin === true;

  // 创建表格模态框状态
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);

  // 状态：表格列表、加载状态和错误
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isEditMode } = useEditMode();

  // 加载表格列表
  const loadTables = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("MobileSidebar: 加载表格列表");
      const response = await fetch("/api/tables");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `获取表格列表失败 (${response.status})`
        );
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "数据格式错误");
      }

      console.log(`MobileSidebar: 成功加载 ${data.tables?.length || 0} 个表格`);
      setTables(data.tables || []);
    } catch (err) {
      console.error("MobileSidebar: 加载表格列表失败:", err);
      setError(err.message || "加载表格列表失败");
      toast.error(`加载表格列表失败: ${err.message || "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载表格列表
  useEffect(() => {
    if (isOpen && expandedMenus.includes("translation-tables")) {
      loadTables();
    }
  }, [isOpen, expandedMenus]);

  // 处理表格选择，添加防御性检查
  const handleTableSelect = (tableId) => {
    console.log(`MobileSidebar: 选择表格 ${tableId}`);

    if (typeof onTableSelect === "function") {
      onTableSelect(tableId);
    } else {
      console.warn("MobileSidebar: onTableSelect 不是一个函数");
      // 降级处理，存储到 localStorage
      localStorage.setItem("selectedTable", tableId);
    }

    if (
      selectedFunction !== "translation-tables" &&
      typeof onFunctionSelect === "function"
    ) {
      onFunctionSelect("translation-tables");
    }

    onClose();
  };

  // 处理功能选择，添加防御性检查
  const handleFunctionSelect = (funcId) => {
    console.log(`MobileSidebar: 选择功能 ${funcId}`);

    if (typeof onFunctionSelect === "function") {
      onFunctionSelect(funcId);
    } else {
      console.warn("MobileSidebar: onFunctionSelect 不是一个函数");
    }
  };

  // 将functions定义移到组件内部
  const functions = [
    {
      id: "global-search",
      name: "全局检索",
      icon: <FiSearch />,
      hasSubItems: false,
    },
    {
      id: "name-search",
      name: "人名检索",
      icon: <FiUsers />,
      hasSubItems: false,
    },
    {
      id: "translation-tables",
      name: "翻译表",
      icon: <FiBook />,
      hasSubItems: true,
    },
  ];

  return (
    <>
      <div
        className={`mobile-backdrop ${isOpen ? "visible" : ""}`}
        onClick={onClose}
      />
      <div
        className={`mobile-sidebar ${isOpen ? "open" : ""} ${theme}-theme`}
        data-current-function={selectedFunction}
      >
        <div className="mobile-sidebar-content">
          <ul className="mobile-menu-list">
            {functions.map((func) => (
              <li key={func.id}>
                <motion.div
                  className={`mobile-menu-item ${
                    selectedFunction === func.id ? "active" : ""
                  } ${
                    func.hasSubItems && expandedMenus.includes(func.id)
                      ? "expanded"
                      : ""
                  }`}
                  data-function-id={func.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFunctionSelect(func.id);
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="mobile-menu-icon">{func.icon}</span>
                  <span className="mobile-menu-name">{func.name}</span>
                  {func.hasSubItems && (
                    <motion.span
                      className="mobile-submenu-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof onToggleMenu === "function") {
                          onToggleMenu(func.id);

                          // 如果展开了翻译表菜单且表格列表为空，尝试加载
                          if (
                            func.id === "translation-tables" &&
                            !expandedMenus.includes(func.id) &&
                            tables.length === 0
                          ) {
                            loadTables();
                          }
                        }
                      }}
                      animate={{
                        rotate: expandedMenus.includes(func.id) ? 180 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown />
                    </motion.span>
                  )}
                </motion.div>
                {func.hasSubItems && (
                  <AnimatePresence>
                    {expandedMenus.includes(func.id) && (
                      <motion.div
                        className="mobile-submenu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="mobile-submenu-header">
                          <span>数据表</span>
                          <div className="mobile-submenu-actions">
                            {/* Use the standalone CreateTableButton component */}
                            <CreateTableButton
                              onTableCreated={loadTables}
                              className="mobile-create-table-button"
                            />

                            <motion.button
                              className="mobile-refresh-tables-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadTables();
                              }}
                              title="刷新表格列表"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={isLoading}
                            >
                              <FiRefreshCw
                                className={isLoading ? "loading" : ""}
                              />
                            </motion.button>
                          </div>
                        </div>

                        {error ? (
                          <div className="mobile-table-list-error">
                            <p>{error}</p>
                            <button onClick={loadTables}>重试</button>
                          </div>
                        ) : isLoading ? (
                          <div className="mobile-table-list-loading">
                            <div className="spinner"></div>
                            <span>加载中...</span>
                          </div>
                        ) : (
                          <ul className="mobile-table-list">
                            {tables && tables.length > 0 ? (
                              tables.map((table) => (
                                <motion.li
                                  key={table.id}
                                  className={`mobile-table-item ${
                                    selectedTable === table.id ? "active" : ""
                                  }`}
                                  onClick={() => handleTableSelect(table.id)}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <span className="mobile-table-icon">
                                    <FiDatabase />
                                  </span>
                                  <span className="mobile-table-name">
                                    {table.name}
                                  </span>
                                </motion.li>
                              ))
                            ) : (
                              <li className="mobile-no-tables-message">
                                没有可用的表格数据
                              </li>
                            )}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default MobileSidebar;
