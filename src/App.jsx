import { useState, useEffect, useRef } from "react";
import JsonTable from "./components/tables/JsonTable.jsx";
import TopBar from "./components/navigation/TopBar.jsx";
import FunctionSidebar from "./components/navigation/FunctionSidebar.jsx";
import GlobalSearch from "./components/search/GlobalSearch.jsx";
import NameSearch from "./components/search/NameSearch.jsx";
import MobileSidebar from "./components/navigation/MobileSidebar.jsx";
import LoadingIndicator from "./components/tables/LoadingIndicator.jsx";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext.jsx";
import { UserProvider } from "./contexts/UserContext.jsx";
import { EditModeProvider } from "./components/navigation/TopBar.jsx";
import { NotificationProvider } from "./contexts/NotificationContext.jsx";
import { toast } from "react-toastify";
import {
  isTableCached,
  getTableFromCache,
  cacheTable,
  isTableLoading,
  markTableLoading,
  clearTableLoading,
  logCacheStatus,
  cleanExpiredTableCache,
} from "./utils/JsonCache.jsx";
import "./App.css";

// 主应用内容组件，使用ThemeContext
function AppContent() {
  // 获取主题上下文
  const { theme } = useTheme();

  // Currently selected function
  const [selectedFunction, setSelectedFunction] = useState("global-search"); // 默认为全局搜索
  // Currently selected table name
  const [selectedTable, setSelectedTable] = useState(null);
  // State for storing the currently selected table data
  const [currentTableData, setCurrentTableData] = useState(null);
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  // Error state
  const [error, setError] = useState(null);
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile view state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // 跟踪展开的菜单
  const [expandedMenus, setExpandedMenus] = useState(["translation-tables"]);
  // 移动端侧边栏状态
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 预加载逻辑跟踪
  const [tablesPreloaded, setTablesPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  // 用于中断预加载的标志
  const shouldContinuePreload = useRef(true);

  // 在应用启动时进行一次清理过期缓存的操作
  useEffect(() => {
    // 清理过期缓存
    const cleanedCount = cleanExpiredTableCache();
    if (cleanedCount > 0) {
      console.log(`[Cache] 已清理 ${cleanedCount} 个过期表格缓存`);
    }

    // 设置定期清理任务
    const cleanupInterval = setInterval(() => {
      const count = cleanExpiredTableCache();
      if (count > 0) {
        console.log(`[Cache] 定期清理: 移除了 ${count} 个过期表格缓存`);
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次

    // 组件卸载时停止清理任务
    return () => {
      clearInterval(cleanupInterval);
      shouldContinuePreload.current = false;
    };
  }, []);

  useEffect(() => {
    if (preloadProgress > 0 && preloadProgress < 100) {
      console.log(`[预加载] 进度: ${preloadProgress}%`);
    }
  }, [preloadProgress]);

  // 应用启动时预加载表格
  useEffect(() => {
    if (tablesPreloaded) return;

    const preloadAllTables = async () => {
      try {
        console.log("[预加载] 开始获取表格列表...");
        const response = await fetch("/api/tables");

        if (!response.ok) {
          throw new Error(`获取表格列表失败: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success || !Array.isArray(result.tables)) {
          throw new Error("返回的表格列表格式不正确");
        }

        const tables = result.tables.map((t) => t.id || t.name);
        console.log(`[预加载] 找到 ${tables.length} 个表格，开始预加载`);

        // 分批预加载表格数据
        const batchSize = 3; // 一次预加载3个表格
        const batchDelay = 1000; // 批次间隔1秒
        let completed = 0;

        for (let i = 0; i < tables.length; i += batchSize) {
          if (!shouldContinuePreload.current) {
            console.log("[预加载] 预加载被中断");
            break;
          }

          const batch = tables.slice(i, i + batchSize);

          // 并行加载当前批次
          await Promise.all(
            batch.map((tableId) => preloadTableData(tableId, true))
          );

          completed += batch.length;

          // 更新进度
          const progress = Math.min(
            100,
            Math.round((completed / tables.length) * 100)
          );
          setPreloadProgress(progress);

          // 如果还有更多表格，等待一段时间再继续
          if (i + batchSize < tables.length && shouldContinuePreload.current) {
            await new Promise((resolve) => setTimeout(resolve, batchDelay));
          }
        }

        console.log("[预加载] 表格预加载完成");
        logCacheStatus();
        setTablesPreloaded(true);
      } catch (error) {
        console.warn("[预加载] 预加载表格失败:", error);
      }
    };

    // 延迟一秒开始预加载，让应用先渲染完成
    const timer = setTimeout(() => {
      preloadAllTables();
    }, 1000);

    return () => {
      clearTimeout(timer);
      shouldContinuePreload.current = false;
    };
  }, [tablesPreloaded]);

  // 表格数据预加载函数，使用JsonCache
  const preloadTableData = async (tableId, isBatchPreload = false) => {
    // 如果已缓存或正在加载，跳过
    if (isTableCached(tableId) || isTableLoading(tableId)) {
      return;
    }

    // 标记为正在加载
    markTableLoading(tableId);

    if (!isBatchPreload) {
      console.log(`[预加载] 开始预加载表格: ${tableId}`);
    }

    try {
      const response = await fetch(`/api/table/${encodeURIComponent(tableId)}`);

      if (!response.ok) {
        throw new Error(`预加载失败: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error("预加载数据格式不正确");
      }

      // 处理数据格式
      let validData = null;
      const keys = Object.keys(result.data);

      if (keys.length === 1 && Array.isArray(result.data[keys[0]])) {
        validData = result.data;
      } else if (Array.isArray(result.data)) {
        validData = { [tableId]: result.data };
      } else if (typeof result.data === "object" && result.data !== null) {
        validData = { [tableId]: [] };
      } else {
        throw new Error("无效的数据格式");
      }

      // 缓存数据
      cacheTable(tableId, validData);

      if (!isBatchPreload) {
        console.log(`[预加载] 表格 ${tableId} 已缓存`);
      }
    } catch (error) {
      console.warn(`[预加载] 表格 ${tableId} 加载失败:`, error);
    } finally {
      // 清除加载标记
      clearTableLoading(tableId);
    }
  };

  // 处理表格悬停预加载
  const handleTableHover = (tableId) => {
    // 如果未缓存且未加载中，触发预加载
    if (!isTableCached(tableId) && !isTableLoading(tableId)) {
      preloadTableData(tableId);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 处理菜单展开/折叠的函数
  const handleToggleMenu = (menuId) => {
    setExpandedMenus((prev) => {
      if (prev.includes(menuId)) {
        return prev.filter((id) => id !== menuId);
      } else {
        return [...prev, menuId];
      }
    });
  };

  // 处理表格选择 - 优先使用缓存
  const handleTableSelect = async (tableId) => {
    console.log(`[选择表格] ${tableId}`);
    setSelectedTable(tableId);
    setSelectedFunction("translation-tables");
    setIsLoading(true);
    setError(null);

    try {
      // 检查缓存中是否有数据
      if (isTableCached(tableId)) {
        console.log(`[选择表格] 使用缓存数据: ${tableId}`);

        const cachedData = getTableFromCache(tableId);
        setCurrentTableData(cachedData);

        // 移动端下选择表格后自动折叠侧边栏
        if (isMobile) {
          setMobileSidebarOpen(false);
        }

        setIsLoading(false);
        return;
      }

      console.log(`[选择表格] 缓存中没有数据，正在加载表格: ${tableId}`);

      // 避免并发加载，使用isTableLoading状态
      if (isTableLoading(tableId)) {
        console.log(`[选择表格] 表格 ${tableId} 正在加载中，等待完成...`);

        // 等待已有的加载完成
        let retries = 0;
        while (isTableLoading(tableId) && retries < 100) {
          await new Promise((r) => setTimeout(r, 50));
          retries++;
        }

        // 再次检查缓存
        if (isTableCached(tableId)) {
          console.log(`[选择表格] 加载完成，使用缓存: ${tableId}`);
          const cachedData = getTableFromCache(tableId);
          setCurrentTableData(cachedData);
          setIsLoading(false);

          if (isMobile) setMobileSidebarOpen(false);
          return;
        }
      }

      // 标记为正在加载
      markTableLoading(tableId);

      const response = await fetch(`/api/table/${encodeURIComponent(tableId)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `服务器返回错误 (${response.status})`
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "数据格式错误");
      }

      if (!result.data) {
        throw new Error("返回的数据为空");
      }

      // 处理数据格式
      let validData = null;
      const keys = Object.keys(result.data);

      if (keys.length === 1 && Array.isArray(result.data[keys[0]])) {
        console.log(
          `[选择表格] 成功加载表格数据, 包含 ${
            result.data[keys[0]].length
          } 条记录`
        );
        validData = result.data;
      } else if (Array.isArray(result.data)) {
        console.log(
          `[选择表格] 成功加载表格数据 (数组格式), 包含 ${result.data.length} 条记录`
        );
        validData = { [tableId]: result.data };
      } else {
        console.warn(`[选择表格] 数据格式不符合预期:`, result.data);

        if (typeof result.data === "object" && result.data !== null) {
          validData = { [tableId]: [] };
          console.warn(`[选择表格] 创建了空数组作为表格数据容器`);
        } else {
          throw new Error("无效的数据格式");
        }
      }

      // 更新状态
      setCurrentTableData(validData);

      // 缓存数据
      cacheTable(tableId, validData);

      // 移动端处理
      if (isMobile) {
        setMobileSidebarOpen(false);
      }
    } catch (error) {
      console.error(`[选择表格] 加载失败: ${error.message}`);
      setError(`加载表格失败: ${error.message}`);
      toast.error(`加载表格失败: ${error.message}`);
      setCurrentTableData(null);
    } finally {
      setIsLoading(false);
      clearTableLoading(tableId);
    }
  };

  // 处理功能选择
  const handleFunctionSelect = (funcId) => {
    setSelectedFunction(funcId);

    // 如果切换到非翻译表功能，清除当前选中的表格
    if (funcId !== "translation-tables") {
      setSelectedTable(null);
      setCurrentTableData(null);
    }

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  // 处理侧边栏折叠切换
  const handleSidebarToggle = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  // 渲染内容区域
  const renderContent = () => {
    if (selectedFunction === "global-search") {
      return (
        <GlobalSearch
          onTableSelect={handleTableSelect} // 传递表格选择函数
          isMobile={isMobile}
        />
      );
    } else if (selectedFunction === "name-search") {
      return <NameSearch />;
    } else if (selectedFunction === "translation-tables") {
      if (!selectedTable) {
        return (
          <div className="no-table-selected">
            <h2>请从左侧选择一个数据表</h2>
            <p>没有选择任何表格</p>
          </div>
        );
      }

      return isLoading ? (
        <LoadingIndicator message="加载表格数据中..." />
      ) : error ? (
        <div className="error-message">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button
            className="retry-button"
            onClick={() => selectedTable && handleTableSelect(selectedTable)}
          >
            重试
          </button>
        </div>
      ) : (
        <JsonTable
          tableName={selectedTable}
          data={currentTableData}
          isMobile={isMobile}
        />
      );
    } else {
      return <GlobalSearch isMobile={isMobile} />;
    }
  };

  return (
    <div
      className={`app-container ${
        isMobile ? "mobile-view" : ""
      } ${theme}-theme`}
    >
      <TopBar isMobile={isMobile} onToggleSidebar={handleSidebarToggle} />

      {isMobile && (
        <MobileSidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          selectedFunction={selectedFunction}
          selectedTable={selectedTable}
          onFunctionSelect={handleFunctionSelect}
          onTableSelect={handleTableSelect}
          expandedMenus={expandedMenus}
          onToggleMenu={handleToggleMenu}
          onTableHover={handleTableHover}
        />
      )}

      <div className="main-content">
        {/* 桌面端使用FunctionSidebar */}
        {!isMobile && (
          <FunctionSidebar
            selectedFunction={selectedFunction}
            onFunctionSelect={handleFunctionSelect}
            collapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
            isMobile={isMobile}
            selectedTable={selectedTable}
            onTableSelect={handleTableSelect}
            onTableHover={handleTableHover}
          />
        )}

        <div className={`content-area ${sidebarCollapsed ? "expanded" : ""}`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// 主应用组件，提供ThemeProvider
function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <UserProvider>
          <EditModeProvider>
            <AppContent />
          </EditModeProvider>
        </UserProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
