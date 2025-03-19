import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiUsers,
  FiBook,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiDatabase,
  FiRefreshCw,
  FiPlus,
} from "react-icons/fi";
import "../styles/FunctionSidebar.css";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useUser } from "../contexts/UserContext.jsx";
import { useEditMode } from "./TopBar.jsx"; // Import the EditMode context
import { toast } from "react-toastify";
import CreateTableButton from "./CreateTableButton.jsx";
import FriendlyLinks from "./FriendlyLinks.jsx";

function FunctionSidebar({
  selectedFunction,
  onFunctionSelect,
  collapsed,
  onToggle,
  isMobile,
  selectedTable,
  onTableSelect,
}) {
  // 使用主题上下文
  const { theme } = useTheme();

  // 获取用户信息
  const { user } = useUser();
  // 判断是否为管理员
  const isAdmin = user?.isAdmin === true;

  // 使用编辑模式上下文
  const { isEditMode } = useEditMode();

  // 创建表格模态框状态
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);

  // 状态：表格列表、加载状态和错误
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 可用功能列表
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

  // 追踪哪些菜单被展开
  const [expandedMenus, setExpandedMenus] = useState(["translation-tables"]);

  // 加载表格列表
  const loadTables = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("正在获取表格列表...");
      const response = await fetch("/api/tables");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `获取表格列表失败 (${response.status})`
        );
      }

      const data = await response.json();
      console.log("获取到表格数据:", data);

      if (!data.success) {
        throw new Error(data.message || "数据格式错误");
      }

      setTables(data.tables || []);
      console.log(`加载了 ${data.tables?.length || 0} 个表格`);
    } catch (err) {
      console.error("加载表格列表失败:", err);
      setError(err.message || "加载表格列表失败");
      toast.error(`加载表格列表失败: ${err.message || "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载表格列表
  useEffect(() => {
    loadTables();
  }, []);

  // 切换子菜单展开/折叠
  const toggleSubMenu = (menuId) => {
    setExpandedMenus((prevState) =>
      prevState.includes(menuId)
        ? prevState.filter((id) => id !== menuId)
        : [...prevState, menuId]
    );
  };

  // 检查一个菜单是否展开
  const isMenuExpanded = (menuId) => expandedMenus.includes(menuId);

  const handleFunctionItemClick = (funcId, hasSubItems) => {
    if (typeof onFunctionSelect === "function") {
      onFunctionSelect(funcId);
    } else {
      console.error("onFunctionSelect 不是一个函数");
    }

    if (hasSubItems) {
      toggleSubMenu(funcId);
    }
  };

  // 处理表格选择
  const handleTableSelect = (e, tableId) => {
    e.stopPropagation();
    console.log(`选择表格: ${tableId}`);

    if (typeof onTableSelect === "function") {
      onTableSelect(tableId);
    } else {
      console.error("onTableSelect 不是一个函数");
    }

    if (
      selectedFunction !== "translation-tables" &&
      typeof onFunctionSelect === "function"
    ) {
      console.log(`切换功能到: translation-tables`);
      onFunctionSelect("translation-tables");
    }
  };

  return (
    <div className={`function-sidebar-container ${isMobile ? "mobile" : ""}`}>
      <motion.div
        className={`function-sidebar ${collapsed ? "collapsed" : ""} ${
          isMobile ? "mobile" : ""
        } ${theme}-theme`}
        initial={false}
        animate={{
          width: !isMobile ? (collapsed ? 50 : 250) : 250,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="function-sidebar-header">
          <motion.h3
            animate={{
              opacity: collapsed && !isMobile ? 0 : 1,
              width: collapsed && !isMobile ? 0 : "auto",
            }}
            transition={{ duration: 0.2 }}
          >
            功能列表
          </motion.h3>
          <motion.button
            className="toggle-button"
            onClick={onToggle}
            aria-label={collapsed ? "展开功能栏" : "收起功能栏"}
            whileHover={{ scale: 1.1 }}
          >
            {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </motion.button>
        </div>

        <div className="function-sidebar-content">
          <ul className="function-list">
            {functions.map((func) => (
              <React.Fragment key={func.id}>
                <motion.li
                  className={`function-item ${
                    selectedFunction === func.id ? "active" : ""
                  } ${
                    func.hasSubItems && isMenuExpanded(func.id)
                      ? "expanded"
                      : ""
                  }`}
                  data-function-id={func.id}
                  onClick={() =>
                    handleFunctionItemClick(func.id, func.hasSubItems)
                  }
                  title={func.name}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="function-icon">{func.icon}</span>
                  <motion.span
                    className="function-name"
                    animate={{
                      opacity: collapsed && !isMobile ? 0 : 1,
                      width: collapsed && !isMobile ? 0 : "auto",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {func.name}
                  </motion.span>
                  {func.hasSubItems && (!collapsed || isMobile) && (
                    <motion.span
                      className="submenu-toggle"
                      animate={{ rotate: isMenuExpanded(func.id) ? 180 : 0 }}
                    >
                      <FiChevronDown />
                    </motion.span>
                  )}
                </motion.li>

                {/* 子菜单 - 翻译表列表 */}
                <AnimatePresence>
                  {func.id === "translation-tables" &&
                    isMenuExpanded(func.id) &&
                    (!collapsed || isMobile) && (
                      <motion.div
                        className="submenu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="submenu-header">
                          <span>数据表</span>
                          <div className="submenu-actions">
                            {/* Use the standalone CreateTableButton component */}
                            <CreateTableButton onTableCreated={loadTables} />

                            <motion.button
                              className="refresh-tables-button"
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
                          <div className="table-list-error">
                            <p>{error}</p>
                            <button onClick={loadTables}>重试</button>
                          </div>
                        ) : isLoading ? (
                          <div className="table-list-loading">
                            <div className="spinner"></div>
                            <span>加载中...</span>
                          </div>
                        ) : (
                          <ul className="table-list">
                            {tables && tables.length > 0 ? (
                              tables.map((table) => (
                                <li
                                  key={table.id}
                                  className={`table-item ${
                                    selectedTable === table.id ? "active" : ""
                                  }`}
                                  onClick={(e) =>
                                    handleTableSelect(e, table.id)
                                  }
                                >
                                  <span className="table-icon">
                                    <FiDatabase />
                                  </span>
                                  <span className="table-name">
                                    {table.name}
                                  </span>
                                </li>
                              ))
                            ) : (
                              <li className="no-tables-message">
                                没有可用的表格数据
                              </li>
                            )}
                          </ul>
                        )}
                      </motion.div>
                    )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </ul>
        </div>
        <FriendlyLinks collapsed={collapsed} />
      </motion.div>
    </div>
  );
}

export default React.memo(FunctionSidebar);
