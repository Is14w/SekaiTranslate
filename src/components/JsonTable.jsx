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

function JsonTable({ data, isMobile }) {
  // State for storing search term
  const [searchTerm, setSearchTerm] = useState("");
  // Store table title
  const [title, setTitle] = useState("");
  // Store table data
  const [tableData, setTableData] = useState([]);
  // Store column names (excluding id field)
  const [columns, setColumns] = useState([]);
  // 控制移动端加载显示的数量
  const [displayCount, setDisplayCount] = useState(50);
  // 加载更多状态
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 用于监测滚动的ref
  const bottomObserverRef = useRef(null);
  // 容器ref，用于添加滚动监听
  const containerRef = useRef(null);

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
    }, 300), // 延长延迟以降低移动端搜索频率
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

  // 实现滚动加载更多
  const loadMoreItems = useCallback(() => {
    // 避免过快重复触发
    if (isLoadingMore) return;

    // 如果已经显示全部，不再加载
    if (displayCount >= filteredData.length) return;

    setIsLoadingMore(true);

    // 使用setTimeout模拟加载过程并减轻UI阻塞
    setTimeout(() => {
      // 每次多加载50条，但不超过总数
      setDisplayCount((prev) => Math.min(prev + 50, filteredData.length));
      setIsLoadingMore(false);
    }, 300);
  }, [displayCount, filteredData.length, isLoadingMore]);

  // 设置交叉观察器，当底部元素进入视图时加载更多
  useEffect(() => {
    if (!isMobile || !bottomObserverRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 } // 当10%的元素可见时触发
    );

    observer.observe(bottomObserverRef.current);

    return () => {
      if (bottomObserverRef.current) {
        observer.unobserve(bottomObserverRef.current);
      }
    };
  }, [isMobile, loadMoreItems]);

  // 当筛选数据变化时，重置显示数量
  useEffect(() => {
    setDisplayCount(50);
  }, [filteredData.length]);

  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return <div className="no-data">请选择一个JSON文件查看内容</div>;
  }

  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return (
      <LoadingIndicator message="数据加载中...如长时间未出现，则此JSON文件不包含表格数据或所有数据的ID小于0" />
    );
  }

  // 获取当前应显示的数据
  const currentDataToDisplay = isMobile
    ? filteredData.slice(0, displayCount)
    : filteredData;

  return (
    <div
      className={`json-table-container ${isMobile ? "mobile" : ""}`}
      ref={containerRef}
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
          <div className="table-wrapper">
            {!isMobile ? (
              // 桌面端表格显示
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
            {isMobile
              ? `显示 ${Math.min(displayCount, filteredData.length)} / ${
                  filteredData.length
                } 条结果`
              : `显示 ${filteredData.length} 条结果 (共 ${tableData.length} 条)`}
          </div>
        </>
      ) : (
        <div className="no-data">找不到匹配的数据</div>
      )}
    </div>
  );
}

export default JsonTable;
