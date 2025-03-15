import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { FiSearch } from "react-icons/fi";
import LoadingIndicator from "./LoadingIndicator";
import "../styles/JsonTable.css";
import { useTheme } from "../contexts/ThemeContext";

function JsonTable({ data, isMobile }) {
  // 使用主题上下文
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

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
          {title && (
            <h3>
              <span className="table-title-text">{title}</span>
            </h3>
          )}

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
                  </div>
                ))}

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
    </div>
  );
}

export default React.memo(JsonTable);
