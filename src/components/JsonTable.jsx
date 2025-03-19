import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  FiSearch,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
} from "react-icons/fi";
import LoadingIndicator from "./LoadingIndicator.jsx";
import "../styles/JsonTable.css";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useUser } from "../contexts/UserContext.jsx";
import { useEditMode } from "../components/TopBar.jsx";
import EditRecordModal from "./EditRecordModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { toast } from "react-toastify";
import {
  isTableCached,
  getTableFromCache,
  cacheTable,
  isTableLoading,
  markTableLoading,
  clearTableLoading,
} from "../utils/JsonCache.jsx";
import { useNotification } from "../contexts/NotificationContext.jsx";

function JsonTable({ tableName, data: propData, isMobile }) {
  // 使用主题上下文
  const { theme } = useTheme();
  const { user } = useUser();
  const { isEditMode } = useEditMode();

  const { showSuccess, showError } = useNotification();

  // Check if user has edit permissions
  const canEdit = isEditMode && user?.isAdmin;

  // 处理输入数据，确保数据格式正确
  const processTableData = useCallback(() => {
    // 如果没有提供表名，返回空数据
    if (!tableName) {
      console.log("未提供表名，返回空数据");
      return { columns: [], data: [] };
    }

    // 从props获取数据
    let tableData = [];

    try {
      // 检查数据格式
      if (propData && typeof propData === "object") {
        // 获取数据对象的所有键
        const keys = Object.keys(propData);

        if (keys.length === 1 && Array.isArray(propData[keys[0]])) {
          // 标准格式: { "表名": [...数据] }
          tableData = propData[keys[0]] || [];
          console.log(`处理表格数据: ${keys[0]}, ${tableData.length} 条记录`);
        } else if (Array.isArray(propData)) {
          // 直接是数组
          tableData = propData;
          console.log(`处理数组数据: ${tableData.length} 条记录`);
        } else {
          console.warn("数据格式不符合预期:", propData);
          tableData = []; // 使用空数组作为后备
        }
      } else {
        console.warn("无效数据:", propData);
        tableData = []; // 使用空数组作为后备
      }

      // 确保每条记录都有id
      tableData = (tableData || []).map((item, index) => {
        if (item === null || typeof item !== "object") {
          return { id: index, value: item }; // 对于非对象值，创建包装对象
        }
        // 为对象类型添加ID
        if (item.id === undefined || item.id === null) {
          return { ...item, id: index };
        }
        return item;
      });

      // 获取列名（排除id列）
      const columnSet = new Set();
      tableData.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((key) => {
            if (key !== "id") {
              columnSet.add(key);
            }
          });
        }
      });

      const columns = Array.from(columnSet);

      return {
        columns: columns,
        data: tableData,
      };
    } catch (err) {
      console.error("处理表格数据时出错:", err);
      return { columns: [], data: [] };
    }
  }, [tableName, propData]);

  useEffect(() => {
    const { columns: newColumns, data: newData } = processTableData();
    setColumns(newColumns);
    setTableData(newData);
    setDisplayCount(50); // 重置显示数量
    setTitle(tableName || "");
  }, [tableName, propData, processTableData]);

  // State for storing search term
  const [searchTerm, setSearchTerm] = useState("");
  // Store table title
  const [title, setTitle] = useState(tableName || "");
  // Store table data
  const [tableData, setTableData] = useState([]);
  // Store column names (excluding id field)
  const [columns, setColumns] = useState([]);
  // 控制显示的数量 (for both mobile and desktop)
  const [displayCount, setDisplayCount] = useState(50);
  // 加载更多状态
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 用于监测滚动的ref
  const bottomObserverRef = useRef(null);
  // 容器ref，用于添加滚动监听
  const tableWrapperRef = useRef(null);
  // 用于防止重复加载的标记
  const isLoadingRef = useRef(false);
  // 使用ref跟踪上次加载的时间，用于节流
  const lastLoadTimeRef = useRef(0);

  // 编辑状态相关
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [jsonModified, setJsonModified] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载状态
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const loadTableData = useCallback(async () => {
    if (!tableName) return;

    setIsInitialLoading(true);
    setLoadingError(null);

    try {
      // 首先检查缓存中是否有数据
      if (isTableCached(tableName)) {
        console.log(`[表格] 使用缓存数据: ${tableName}`);

        const cachedData = getTableFromCache(tableName);

        // 设置表格标题
        setTitle(tableName);

        // 处理缓存中的数据
        let tableData;
        const keys = Object.keys(cachedData);

        if (keys.length === 1 && Array.isArray(cachedData[keys[0]])) {
          // 标准格式: { "表名": [...] }
          tableData = cachedData[keys[0]];
          console.log(
            `[表格] 处理缓存数据: ${keys[0]}, ${tableData.length} 条记录`
          );
        } else if (Array.isArray(cachedData)) {
          // 直接是数组
          tableData = cachedData;
          console.log(`[表格] 处理缓存数组数据: ${tableData.length} 条记录`);
        } else {
          console.warn("[表格] 缓存数据格式不符合预期，尝试从API加载");
          tableData = null;
        }

        // 如果成功解析了缓存数据
        if (tableData && Array.isArray(tableData)) {
          setTableData(tableData);

          // 重置显示数量
          setDisplayCount(50);

          // 获取列名
          if (tableData.length > 0) {
            const columnSet = new Set();
            tableData.forEach((row) => {
              if (row && typeof row === "object") {
                Object.keys(row).forEach((key) => {
                  if (key !== "id") {
                    columnSet.add(key);
                  }
                });
              }
            });
            const filteredColumns = Array.from(columnSet);
            setColumns(filteredColumns);
          } else {
            setColumns([]);
          }

          // 重置修改标志
          setJsonModified(false);
          setIsInitialLoading(false);
          return; // 使用缓存数据，提前返回
        }
      }

      // 检查是否正在加载
      if (isTableLoading(tableName)) {
        console.log(`[表格] ${tableName} 正在由其他组件加载中，等待完成...`);

        // 等待已有的加载完成
        let retries = 0;
        while (isTableLoading(tableName) && retries < 100) {
          await new Promise((r) => setTimeout(r, 50));
          retries++;
        }

        // 再次检查缓存
        if (isTableCached(tableName)) {
          console.log(`[表格] 等待后发现缓存可用: ${tableName}`);
          // 递归调用自身，使用缓存数据
          loadTableData();
          return;
        }
      }

      // 标记为正在加载
      markTableLoading(tableName);

      try {
        // 从API获取数据
        console.log(`[表格] 从API加载表格数据: ${tableName}`);
        const response = await fetch(
          `/api/table/${encodeURIComponent(tableName)}`
        );

        // 检查响应类型，避免解析非JSON内容
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(
            `服务器返回了非JSON格式的数据 (${contentType || "未知类型"})`
          );
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `加载表格数据失败`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "数据格式错误");
        }

        // 提取实际数据，处理嵌套格式
        let tableData;
        if (result.data) {
          if (Array.isArray(result.data)) {
            // 如果data直接是数组
            tableData = result.data;
          } else if (typeof result.data === "object") {
            // 如果data是对象，查找其中的数组
            const keys = Object.keys(result.data);
            if (keys.length === 1 && Array.isArray(result.data[keys[0]])) {
              // 标准格式: { "表名": [...] }
              tableData = result.data[keys[0]];
            } else {
              // 尝试查找数组属性
              let foundArray = false;
              for (const [key, value] of Object.entries(result.data)) {
                if (Array.isArray(value)) {
                  tableData = value;
                  foundArray = true;
                  break;
                }
              }

              if (!foundArray) {
                // 如果没有找到数组，将整个对象作为单条记录
                tableData = [result.data];
              }
            }
          }
        }

        // 如果仍然没有有效数据，使用空数组
        if (!tableData || !Array.isArray(tableData)) {
          console.warn("无法解析有效的表格数据，使用空数组");
          tableData = [];
        }

        // 缓存成功获取的数据
        cacheTable(tableName, result.data);

        // 设置表格标题
        setTitle(tableName);

        // 设置表格数据
        setTableData(tableData);

        // 重置显示数量
        setDisplayCount(50);

        // 获取列名
        if (tableData.length > 0) {
          const columnSet = new Set();
          tableData.forEach((row) => {
            if (row && typeof row === "object") {
              Object.keys(row).forEach((key) => {
                if (key !== "id") {
                  columnSet.add(key);
                }
              });
            }
          });
          const filteredColumns = Array.from(columnSet);
          setColumns(filteredColumns);
        } else {
          setColumns([]);
        }

        // 重置修改标志
        setJsonModified(false);
      } catch (err) {
        console.error(`[表格] 加载表格${tableName}失败:`, err);
        setLoadingError(err.message || "加载数据失败");
      } finally {
        // 始终清除加载标记
        clearTableLoading(tableName);
        setIsInitialLoading(false);
      }
    } catch (err) {
      console.error(`[表格] 处理表格${tableName}失败:`, err);
      setLoadingError(err.message || "加载数据失败");
      setIsInitialLoading(false);
    }
  }, [tableName]);

  // 初始加载
  useEffect(() => {
    loadTableData();
  }, [loadTableData, tableName]);

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Create debounced search function with useCallback
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
      // 搜索时重置显示条数
      setDisplayCount(50);
    }, 300), // 延长延迟以降低搜索频率
    []
  );

  // Handle search input change with better performance
  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const filteredData = useMemo(() => {
    // 确保 tableData 是数组
    if (!tableData || !Array.isArray(tableData)) return [];

    // 确保 columns 也存在
    if (!columns || !Array.isArray(columns) || columns.length === 0)
      return tableData || [];

    if (!searchTerm) return tableData;

    // 增加更严格的检查
    try {
      return tableData.filter((row) => {
        if (!row || typeof row !== "object") return false;

        return columns.some((col) => {
          // 增加列存在性检查
          if (!col) return false;

          const cellValue = row[col];
          if (cellValue === undefined || cellValue === null) return false;

          // 安全转换为字符串
          const stringValue = String(cellValue);
          return stringValue
            .toLowerCase()
            .includes((searchTerm || "").toLowerCase());
        });
      });
    } catch (error) {
      console.error("过滤数据时出错:", error);
      return [];
    }
  }, [tableData, columns, searchTerm]);

  // 实现滚动加载更多 - 优化版
  const loadMoreItems = useCallback(() => {
    // 使用ref来防止并发调用和频繁触发
    if (isLoadingRef.current) return;

    // 如果已经显示全部，不再加载
    if (displayCount >= filteredData.length) return;

    // 使用节流技术：确保两次加载之间至少间隔500ms
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 500) return;

    // 设置加载标志
    isLoadingRef.current = true;
    setIsLoadingMore(true);
    lastLoadTimeRef.current = now;

    // 使用setTimeout模拟加载过程并减轻UI阻塞
    setTimeout(() => {
      // 每次多加载50条，但不超过总数
      setDisplayCount((prev) => Math.min(prev + 50, filteredData.length));
      setIsLoadingMore(false);
      // 重置加载标志，但延迟一点以防止触发太快
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 100);
    }, 300);
  }, [displayCount, filteredData.length]);

  // 优化后的滚动处理函数，使用节流而不是每次滚动都检查
  const handleScroll = useCallback(() => {
    if (!tableWrapperRef.current) return;

    // 如果正在加载，不处理滚动事件
    if (isLoadingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = tableWrapperRef.current;

    // 使用更大的缓冲区，当距离底部200px时开始加载
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      requestAnimationFrame(() => {
        loadMoreItems();
      });
    }
  }, [loadMoreItems]);

  // 添加滚动事件监听 - 使用节流
  useEffect(() => {
    const tableWrapper = tableWrapperRef.current;
    if (!tableWrapper) return;

    // 创建节流版本的滚动处理函数
    let scrollTimeout;
    const throttledScrollHandler = () => {
      if (scrollTimeout) return;

      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 150); // 150ms节流间隔
    };

    tableWrapper.addEventListener("scroll", throttledScrollHandler);

    return () => {
      tableWrapper.removeEventListener("scroll", throttledScrollHandler);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll]);

  // 设置移动端交叉观察器，当底部元素进入视图时加载更多
  useEffect(() => {
    if (!isMobile || !bottomObserverRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingRef.current) {
          loadMoreItems();
        }
      },
      { threshold: 0.1, rootMargin: "100px" } // 增加rootMargin，提前触发
    );

    observer.observe(bottomObserverRef.current);

    return () => {
      if (bottomObserverRef.current) {
        observer.unobserve(bottomObserverRef.current);
      }
    };
  }, [isMobile, loadMoreItems]);

  // 当筛选数据变化时，重置显示数量和加载状态
  useEffect(() => {
    setDisplayCount(50);
    isLoadingRef.current = false;
    lastLoadTimeRef.current = 0;
  }, [filteredData.length]);

  // 处理编辑记录
  const handleEditRecord = (record) => {
    setCurrentEditRecord({ ...record });
    setIsNewRecord(false);
    setEditModalOpen(true);
  };

  // 处理添加新记录
  const handleAddRecord = () => {
    // 创建一个空记录模板，包含所有列但值为null
    const newRecord = {
      id: getNextId(),
    };

    columns.forEach((column) => {
      newRecord[column] = null;
    });

    setCurrentEditRecord(newRecord);
    setIsNewRecord(true);
    setEditModalOpen(true);
  };

  // 获取下一个可用ID
  const getNextId = () => {
    if (!tableData || tableData.length === 0) return 0;
    return Math.max(...tableData.map((item) => item.id)) + 1;
  };

  // 处理删除记录确认
  const handleDeleteConfirm = (record) => {
    setRecordToDelete(record);
    setConfirmDialogOpen(true);
  };

  const executeDelete = () => {
    if (!recordToDelete) return;

    try {
      // 从数据中删除该记录
      const newData = tableData.filter((item) => item.id !== recordToDelete.id);

      // 对剩余记录重新排序ID
      const reorderedData = newData.map((item, index) => ({
        ...item,
        id: index,
      }));

      setTableData(reorderedData);
      setJsonModified(true);
      setConfirmDialogOpen(false);
      setRecordToDelete(null);

      showSuccess("记录删除成功");
    } catch (error) {
      console.error("删除记录失败:", error);
      showError("删除记录失败: " + (error.message || "未知错误"));
    }
  };

  // 保存编辑后的记录
  const saveRecord = (record) => {
    try {
      if (isNewRecord) {
        // 添加新记录
        setTableData((prevData) =>
          [...prevData, record].sort((a, b) => a.id - b.id)
        );
        showSuccess("新记录添加成功");
      } else {
        // 更新现有记录
        setTableData((prevData) =>
          prevData.map((item) => (item.id === record.id ? record : item))
        );
        showSuccess("记录更新成功");
      }

      setJsonModified(true);
      setEditModalOpen(false);
      setCurrentEditRecord(null);
    } catch (error) {
      console.error("保存记录失败:", error);
      showError("保存记录失败: " + (error.message || "未知错误"));
    }
  };

  const saveTableData = async () => {
    if (!jsonModified || !title) return;

    try {
      // 显示保存中状态
      setSaving(true);

      // 发送到服务器
      const response = await fetch(`/api/table/${encodeURIComponent(title)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          data: tableData,
        }),
      });

      if (response.ok) {
        // 保存成功
        setJsonModified(false);
        showSuccess("表格数据保存成功！");
        console.log(`[表格] 已成功保存表格数据: ${title}`);

        // 更新缓存
        const dataToCache = { [title]: tableData };
        cacheTable(title, dataToCache);
        console.log(`[表格] 已更新缓存: ${title}`);
      } else {
        const errorData = await response.json();
        showError(`保存失败: ${errorData.message}`);
        console.error("[表格] 保存失败:", errorData);
      }
    } catch (error) {
      console.error("[表格] 保存数据时出错:", error);
      showError(`保存失败: ${error.message || "未知错误"}`);
    } finally {
      // 无论成功失败，都关闭保存中状态
      setSaving(false);
    }
  };

  // 处理刷新按钮点击
  const handleRefresh = () => {
    if (jsonModified) {
      if (confirm("当前有未保存的更改，刷新将丢失这些更改。确定要刷新吗？")) {
        loadTableData();
      }
    } else {
      loadTableData();
    }
  };

  // 如果正在加载
  if (isInitialLoading) {
    return <LoadingIndicator message={`加载表格 ${tableName} 中...`} />;
  }

  // 如果加载出错
  if (loadingError) {
    return (
      <div className={`error-container ${theme}-theme`}>
        <div className="error-message">
          <FiAlertCircle size={24} />
          <p>{loadingError}</p>
        </div>
        <button className="refresh-button" onClick={loadTableData}>
          <FiRefreshCw /> 重试
        </button>
      </div>
    );
  }

  // 如果没有数据
  if (!tableData || tableData.length === 0) {
    return (
      <div className={`no-data ${theme}-theme`}>
        <p>此表格当前没有数据</p>
        {canEdit && (
          <button
            className="edit-control-button add-button"
            onClick={handleAddRecord}
          >
            <FiPlus /> 添加记录
          </button>
        )}
      </div>
    );
  }

  const currentDataToDisplay = Array.isArray(filteredData)
    ? filteredData.slice(0, displayCount)
    : [];

  return (
    <div
      className={`json-table-container ${
        isMobile ? "mobile" : ""
      } ${theme}-theme`}
    >
      <div className="header-container">
        <div className="table-header">
          <div className="title-section">
            {title && (
              <h3>
                <span className="table-title-text">{title}</span>
              </h3>
            )}

            {/* 添加编辑模式按钮 */}
            <div className="edit-controls">
              <button
                className="edit-control-button refresh-button"
                onClick={handleRefresh}
                title="刷新数据"
              >
                <FiRefreshCw /> 刷新
              </button>

              {canEdit && (
                <>
                  <button
                    className="edit-control-button add-button"
                    onClick={handleAddRecord}
                    title="添加新记录"
                  >
                    <FiPlus /> 添加记录
                  </button>

                  {jsonModified && (
                    <button
                      className={`edit-control-button save-button ${
                        saving ? "saving" : ""
                      }`}
                      onClick={saveTableData}
                      title="保存修改"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <div className="button-spinner"></div> 保存中...
                        </>
                      ) : (
                        <>
                          <FiSave /> 保存修改
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="搜索..."
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {columns.length > 0 && filteredData.length > 0 ? (
        <>
          <div className="table-wrapper" ref={tableWrapperRef}>
            {!isMobile ? (
              // 桌面端表格显示
              <>
                <table className="json-table">
                  <thead>
                    <tr>
                      {columns.map((column, index) => (
                        <th key={index}>{column}</th>
                      ))}
                      {canEdit && <th className="action-column">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentDataToDisplay.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {columns.map((column, colIndex) => (
                          <td key={colIndex}>
                            {row[column] === undefined || row[column] === null
                              ? "" // Display empty string instead of "N/A" or "undefined"
                              : String(row[column])
                                  .split("\n")
                                  .map((line, i) => (
                                    <React.Fragment key={i}>
                                      {line}
                                      {i <
                                        String(row[column]).split("\n").length -
                                          1 && <br />}
                                    </React.Fragment>
                                  ))}
                          </td>
                        ))}
                        {canEdit && (
                          <td className="action-column">
                            <button
                              className="table-action-button edit-button"
                              onClick={() => handleEditRecord(row)}
                              title="编辑记录"
                            >
                              <FiEdit />
                            </button>
                            <button
                              className="table-action-button delete-button"
                              onClick={() => handleDeleteConfirm(row)}
                              title="删除记录"
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* PC版加载更多提示 */}
                {filteredData.length > displayCount && (
                  <div className="desktop-load-more">
                    {isLoadingMore ? (
                      <LoadingIndicator message="加载更多内容中..." />
                    ) : (
                      <div>向下滚动加载更多</div>
                    )}
                  </div>
                )}

                {/* 已显示全部的提示 */}
                {displayCount >= filteredData.length && displayCount > 50 && (
                  <div className="desktop-load-more all-loaded">
                    已显示全部 {filteredData.length} 条结果
                  </div>
                )}
              </>
            ) : (
              // 移动端卡片式显示
              <div className="mobile-cards">
                {currentDataToDisplay.map((row, rowIndex) => (
                  <div className="mobile-card" key={rowIndex}>
                    {columns.map((column, colIndex) =>
                      // Only render fields that have values
                      row[column] !== undefined && row[column] !== null ? (
                        <div className="mobile-field" key={colIndex}>
                          <div className="mobile-label">{column}</div>
                          <div className="mobile-value">
                            {String(row[column])
                              .split("\n")
                              .map((line, i) => (
                                <React.Fragment key={i}>
                                  {line}
                                  {i <
                                    String(row[column]).split("\n").length -
                                      1 && <br />}
                                </React.Fragment>
                              ))}
                          </div>
                        </div>
                      ) : null
                    )}

                    {canEdit && (
                      <div className="mobile-actions">
                        <button
                          className="mobile-action-button edit-button"
                          onClick={() => handleEditRecord(row)}
                        >
                          <FiEdit /> 编辑
                        </button>
                        <button
                          className="mobile-action-button delete-button"
                          onClick={() => handleDeleteConfirm(row)}
                        >
                          <FiTrash2 /> 删除
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* 移动端添加按钮 - 在编辑模式下显示 */}
                {canEdit && (
                  <div className="mobile-add-button-container">
                    <button
                      className="mobile-add-button"
                      onClick={handleAddRecord}
                    >
                      <FiPlus /> 添加记录
                    </button>

                    {jsonModified && (
                      <button
                        className="mobile-save-button"
                        onClick={saveTableData}
                      >
                        <FiSave /> 保存修改
                      </button>
                    )}
                  </div>
                )}

                {/* 加载更多提示，当有更多内容时显示 */}
                {filteredData.length > displayCount && (
                  <div className="mobile-load-more" ref={bottomObserverRef}>
                    {isLoadingMore ? (
                      <LoadingIndicator message="加载更多内容中..." />
                    ) : (
                      <div>向下滑动加载更多</div>
                    )}
                  </div>
                )}

                {/* 已显示全部的提示 */}
                {displayCount >= filteredData.length && displayCount > 50 && (
                  <div className="mobile-load-more all-loaded">
                    已显示全部 {filteredData.length} 条结果
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="results-count">
            {`显示 ${Math.min(displayCount, filteredData.length)} / ${
              filteredData.length
            } 条结果 (共 ${tableData.length} 条)`}
          </div>
        </>
      ) : (
        <div className={`no-data ${theme}-theme`}>找不到匹配的数据</div>
      )}

      {/* 编辑记录的模态窗口 */}
      <EditRecordModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        record={currentEditRecord}
        columns={columns}
        onSave={saveRecord}
        isNew={isNewRecord}
      />

      {/* 确认删除对话框 */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={executeDelete}
        title="确认删除"
        message={`确定要删除这条记录吗？这将会重新排序所有ID。此操作无法撤销。`}
      />
    </div>
  );
}

export default React.memo(JsonTable);
