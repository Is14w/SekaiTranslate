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
  FiX,
} from "react-icons/fi";
import LoadingIndicator from "./LoadingIndicator";
import "../styles/JsonTable.css";
import { useTheme } from "../contexts/ThemeContext";
import { useUser } from "../contexts/UserContext";
import { useEditMode } from "../components/TopBar";
import EditRecordModal from "./EditRecordModal";
import ConfirmDialog from "./ConfirmDialog";

function JsonTable({ data, isMobile }) {
  // 使用主题上下文
  const { theme } = useTheme();
  const { user } = useUser();
  const { isEditMode } = useEditMode();

  // Check if user has edit permissions
  const canEdit = isEditMode && user?.isAdmin;

  // State for storing search term
  const [searchTerm, setSearchTerm] = useState("");
  // Store table title
  const [title, setTitle] = useState("");
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

  // Process data on initialization
  useEffect(() => {
    // Check if data exists
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      return;
    }

    // Get sheet title (first key)
    const dataTitle = Object.keys(data)[0];
    setTitle(dataTitle);

    // Check table data
    const rawTableData = data[dataTitle];
    if (
      !rawTableData ||
      !Array.isArray(rawTableData) ||
      rawTableData.length === 0
    ) {
      return;
    }

    // Filter out rows with id < 0
    const validData = rawTableData.filter((row) => row.id >= 0);
    setTableData(validData);

    // 重置显示数量
    setDisplayCount(50);

    // Get column names excluding the id field
    if (validData.length > 0) {
      const columnSet = new Set();
      validData.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (key !== "id") {
            columnSet.add(key);
          }
        });
      });
      const filteredColumns = Array.from(columnSet);
      setColumns(filteredColumns);
    }

    // Reset the modified flag when new data is loaded
    setJsonModified(false);
  }, [data]);

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

  // Filter data using useMemo for better performance
  const filteredData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];

    if (searchTerm.trim() === "") {
      return tableData;
    }

    const lowercasedTerm = searchTerm.toLowerCase();

    return tableData.filter((row) => {
      // Search for matches in all columns
      return columns.some((column) => {
        const value = row[column];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowercasedTerm);
      });
    });
  }, [searchTerm, tableData, columns]);

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

  // 执行删除记录并重新排序ID
  const executeDelete = () => {
    if (!recordToDelete) return;

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
  };

  // 保存编辑后的记录
  const saveRecord = (record) => {
    if (isNewRecord) {
      // 添加新记录
      setTableData((prevData) =>
        [...prevData, record].sort((a, b) => a.id - b.id)
      );
    } else {
      // 更新现有记录
      setTableData((prevData) =>
        prevData.map((item) => (item.id === record.id ? record : item))
      );
    }

    setJsonModified(true);
    setEditModalOpen(false);
    setCurrentEditRecord(null);
  };

  // 保存JSON到服务器
  const saveJsonToServer = async () => {
    if (!jsonModified || !title) return;

    try {
      // 创建要保存的JSON对象
      const jsonToSave = {
        [title]: tableData,
      };

      // 发送到服务器
      const response = await fetch("/api/save-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          filename: `${title}.json`,
          data: jsonToSave,
        }),
      });

      if (response.ok) {
        alert("JSON保存成功！");
        setJsonModified(false);
      } else {
        const error = await response.json();
        alert(`保存失败: ${error.message}`);
      }
    } catch (error) {
      console.error("保存JSON时出错:", error);
      alert(`保存失败: ${error.message}`);
    }
  };

  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return (
      <div className={`no-data ${theme}-theme`}>请选择一个JSON文件查看内容</div>
    );
  }

  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return (
      <LoadingIndicator message="数据加载中...如长时间未出现，则此JSON文件不包含表格数据或所有数据的ID小于0" />
    );
  }

  // 获取当前应显示的数据
  const currentDataToDisplay = filteredData.slice(0, displayCount);

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
            {canEdit && (
              <div className="edit-controls">
                <button
                  className="edit-control-button add-button"
                  onClick={handleAddRecord}
                  title="添加新记录"
                >
                  <FiPlus /> 添加记录
                </button>

                {jsonModified && (
                  <button
                    className="edit-control-button save-button"
                    onClick={saveJsonToServer}
                    title="保存修改"
                  >
                    <FiSave /> 保存修改
                  </button>
                )}
              </div>
            )}
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
                        onClick={saveJsonToServer}
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
