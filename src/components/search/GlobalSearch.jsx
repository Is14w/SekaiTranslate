// 修改导入，添加 JsonCache 支持
import React, { useState, useEffect, useCallback, useRef } from "react";
// eslint-disable-next-line
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiFile,
  FiChevronDown,
  FiChevronUp,
  FiDatabase,
  FiX,
  FiTag,
} from "react-icons/fi";
import LoadingIndicator from "../tables/LoadingIndicator.jsx";
import {
  isTableCached,
  getTableFromCache,
  cacheTable,
  isTableLoading,
  markTableLoading,
  clearTableLoading,
} from "../../utils/JsonCache.jsx";
import "../../styles/GlobalSearch.css";

function GlobalSearch({
  onTableSelect = () => {}, // 替换 onFileSelect 为 onTableSelect
  isMobile = false,
}) {
  // 搜索状态
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // 结果分组
  const [groupedResults, setGroupedResults] = useState({});
  // 展开的结果组
  const [expandedGroups, setExpandedGroups] = useState([]);
  // 结果计数
  const [resultCounts, setResultCounts] = useState({
    total: 0,
    byFile: {},
  });
  // 搜索框获得焦点状态
  const [isFocused, setIsFocused] = useState(false);

  // 标签状态管理
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const [allTags, setAllTags] = useState([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [currentTagInput, setCurrentTagInput] = useState("");
  const tagSuggestionsRef = useRef(null);
  const [currentSelectedSuggestion, setCurrentSelectedSuggestion] =
    useState("");

  const [expandedItems, setExpandedItems] = useState([]);
  const [copiedItems, setCopiedItems] = useState({});

  const [tables, setTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState(null);

  // 输入框引用
  const searchInputRef = useRef(null);

  // 设置最大结果限制
  const MAX_RESULTS_PER_FILE = isMobile ? 20 : 50;
  const MAX_TOTAL_RESULTS = isMobile ? 100 : 300;

  useEffect(() => {
    const loadTables = async () => {
      setIsLoadingTables(true);
      setTablesError(null);

      try {
        const response = await fetch("/api/tables");

        if (!response.ok) {
          throw new Error(`获取表格列表失败: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "数据格式错误");
        }

        // 设置表格列表
        const tablesList = result.tables || [];
        setTables(tablesList.map((table) => table.name || table.id));
        console.log(`加载了 ${tablesList.length} 个表格`);
      } catch (error) {
        console.error("加载表格列表失败:", error);
        setTablesError(error.message);
      } finally {
        setIsLoadingTables(false);
      }
    };

    loadTables();
  }, []);

  const copyToClipboard = (text, itemId) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // 更新复制状态，显示反馈
        setCopiedItems((prev) => ({
          ...prev,
          [itemId]: true,
        }));

        // 2秒后重置状态
        setTimeout(() => {
          setCopiedItems((prev) => ({
            ...prev,
            [itemId]: false,
          }));
        }, 2000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
      });
  };

  const loadAllTags = useCallback(async () => {
    if (allTags.length > 0 || isLoadingTags || !tables || tables.length === 0)
      return;

    setIsLoadingTags(true);

    try {
      const uniqueTags = new Set();
      console.log("[标签] 开始从缓存或API加载标签...");

      // 每次处理少量表格，避免阻塞主线程
      const batchSize = 5;

      for (let i = 0; i < tables.length; i += batchSize) {
        const batch = tables.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (tableName) => {
            try {
              let tableData;

              // 首先尝试从缓存获取数据
              if (isTableCached(tableName)) {
                console.log(`[标签] 使用缓存数据加载标签: ${tableName}`);
                tableData = getTableFromCache(tableName);
              } else {
                // 缓存中没有，从API获取
                if (isTableLoading(tableName)) {
                  console.log(`[标签] 表格 ${tableName} 正在加载中，跳过`);
                  return; // 跳过正在加载的表格
                }

                markTableLoading(tableName);
                console.log(`[标签] 从API加载表格标签数据: ${tableName}`);

                try {
                  const apiUrl = `/api/table/${encodeURIComponent(tableName)}`;
                  const response = await fetch(apiUrl);

                  if (!response.ok) {
                    throw new Error(
                      `无法加载表格: ${tableName} (${response.status})`
                    );
                  }

                  const result = await response.json();

                  // 检查 API 返回的格式
                  if (!result.success) {
                    throw new Error(result.message);
                  }

                  // 缓存获取到的数据
                  cacheTable(tableName, result.data);
                  tableData = result.data;
                } finally {
                  clearTableLoading(tableName);
                }
              }

              // 获取表格数据后，无论从缓存还是API
              // 提取所有标签 - 支持 Tag_{Number} 格式
              const tableArray = Array.isArray(tableData)
                ? tableData
                : tableData &&
                  typeof tableData === "object" &&
                  Object.values(tableData)[0];

              if (Array.isArray(tableArray)) {
                tableArray.forEach((row) => {
                  if (!row || typeof row !== "object") return;

                  // 查找所有 Tag_* 字段
                  Object.keys(row).forEach((key) => {
                    if (key.match(/^Tag_\d+$/) && row[key]) {
                      // 添加标签到集合
                      uniqueTags.add(String(row[key]).toLowerCase());
                    }
                  });
                });
              }
            } catch (error) {
              console.warn(`[标签] 读取表格 ${tableName} 标签时出错:`, error);
            }
          })
        );

        // 更新已找到的标签，让用户尽早看到结果
        if (uniqueTags.size > 0) {
          setAllTags(Array.from(uniqueTags).sort());
        }

        // 如果处理耗时，给UI一点时间响应
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 最终更新所有标签列表
      setAllTags(Array.from(uniqueTags).sort());
      console.log(`[标签] 成功加载了 ${uniqueTags.size} 个标签`);
    } catch (error) {
      console.error("[标签] 加载标签时出错:", error);
    } finally {
      setIsLoadingTags(false);
    }
  }, [tables, allTags, isLoadingTags]);

  useEffect(() => {
    if (tables.length > 0) {
      loadAllTags();
    }
  }, [tables, loadAllTags]);

  // 防抖函数
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

  // 处理输入变化
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // 检查是否正在输入标签
    const hashIndex = value.lastIndexOf("#");
    if (hashIndex !== -1) {
      const afterHash = value.substring(hashIndex + 1);
      const spaceAfterHash = afterHash.indexOf(" ");

      // 如果 # 后没有空格，说明用户正在输入标签
      if (spaceAfterHash === -1) {
        setCurrentTagInput(afterHash.toLowerCase());

        // 过滤并显示标签建议
        if (allTags.length > 0) {
          const suggestions = allTags
            .filter((tag) =>
              tag.toLowerCase().includes(afterHash.toLowerCase())
            )
            .filter((tag) => !tags.includes(tag.toLowerCase())) // 排除已选标签
            .slice(0, 10); // 限制建议数量

          setTagSuggestions(suggestions);
          setShowTagSuggestions(suggestions.length > 0);
        }
      } else {
        // # 后有空格，不显示建议
        setShowTagSuggestions(false);
      }
    } else {
      // 输入中没有 #，不显示建议
      setShowTagSuggestions(false);
    }
  };

  // 选择标签建议
  const selectTagSuggestion = (tag) => {
    // 找到当前正在输入的标签位置
    const hashIndex = inputValue.lastIndexOf("#");
    if (hashIndex === -1) return;

    // 确定标签文本结束的位置
    let tagEndIndex = inputValue.length;

    // 查找标签后面的第一个空格
    const afterHashText = inputValue.substring(hashIndex);
    const spaceIndex = afterHashText.search(/\s/);
    if (spaceIndex !== -1) {
      tagEndIndex = hashIndex + spaceIndex;
    }

    // 从输入框中移除当前正在输入的标签
    const beforeTag = inputValue.substring(0, hashIndex);
    const afterTag =
      tagEndIndex < inputValue.length ? inputValue.substring(tagEndIndex) : "";

    // 设置新的干净输入值，不包含刚才的标签
    const newInputValue = beforeTag + afterTag;
    setInputValue(newInputValue);

    // 隐藏建议
    setShowTagSuggestions(false);

    // 先添加标签到列表
    const newTags = [...new Set([...tags, tag.toLowerCase()])];
    setTags(newTags);

    // 保持光标在输入框并执行搜索
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);

    // 分离搜索操作，避免立即触发，给UI更新的时间
    setTimeout(() => {
      // 执行搜索
      const cleanInput = newInputValue.trim();
      if (cleanInput.length >= 2) {
        performSearch(cleanInput, newTags);
      } else if (newTags.length > 0) {
        performSearch("", newTags);
      }
    }, 50);
  };

  const handleSearchFocus = () => {
    setIsFocused(true);

    // 在移动设备上，将搜索框滚动到视图顶部
    if (isMobile) {
      // 延时执行确保键盘弹出后再滚动
      setTimeout(() => {
        // 滚动搜索框到视图顶部
        if (searchInputRef.current) {
          const yOffset = -20; // 添加一点顶部间距
          const elementRect = searchInputRef.current.getBoundingClientRect();
          const absoluteY = window.pageYOffset + elementRect.top + yOffset;

          window.scrollTo({
            top: absoluteY,
            behavior: "smooth",
          });
        }
      }, 300); // 延时300ms等待输入法弹出
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    // 如果显示标签建议，处理上下键和Enter
    if (showTagSuggestions && tagSuggestions.length > 0) {
      const currentIndex = tagSuggestions.findIndex(
        (t) => t.toLowerCase() === currentSelectedSuggestion
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < tagSuggestions.length - 1 ? currentIndex + 1 : 0;
        setCurrentSelectedSuggestion(tagSuggestions[nextIndex].toLowerCase());
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : tagSuggestions.length - 1;
        setCurrentSelectedSuggestion(tagSuggestions[prevIndex].toLowerCase());
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && currentSelectedSuggestion) {
        e.preventDefault();
        selectTagSuggestion(currentSelectedSuggestion);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (tagSuggestions.length > 0) {
          selectTagSuggestion(tagSuggestions[0]);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowTagSuggestions(false);
        return;
      }
    }

    // 原有的Enter键处理 - 修改为使用同样的逻辑
    if (e.key === "Enter" && !e.shiftKey && !showTagSuggestions) {
      e.preventDefault(); // 阻止表单提交

      // 检测输入中的标签 (#tag格式)
      const tagRegex = /#(\S+)/g;
      let match;
      const inputTags = [];
      const matches = [];

      // 提取所有标签和它们的位置
      while ((match = tagRegex.exec(inputValue)) !== null) {
        inputTags.push(match[1].toLowerCase());
        matches.push({
          tag: match[1].toLowerCase(),
          start: match.index,
          end: match.index + match[0].length,
        });
      }

      if (matches.length > 0) {
        // 将新标签添加到标签列表，去重
        const newTags = [...new Set([...tags, ...inputTags])];
        setTags(newTags);

        // 移除输入中的所有标签
        let newInputValue = inputValue;

        // 从后向前删除，以避免位置偏移
        for (let i = matches.length - 1; i >= 0; i--) {
          const { start, end } = matches[i];
          newInputValue =
            newInputValue.substring(0, start) + newInputValue.substring(end);
        }

        newInputValue = newInputValue.trim();
        setInputValue(newInputValue);

        // 根据新的条件进行搜索
        if (newInputValue.length > 0) {
          // 有文本和标签
          performSearch(newInputValue, newTags);
        } else {
          // 只有标签
          performSearch("", newTags);
        }
      } else if (inputValue.trim().length > 0) {
        // 无新标签但有有效的搜索词
        performSearch(inputValue.trim(), tags);
      }
    }
  };

  useEffect(() => {
    // 检测虚拟键盘弹出造成的视口大小变化
    const handleResize = () => {
      if (isMobile && isFocused) {
        // 当输入框获得焦点且视口大小改变时(通常是虚拟键盘弹出)
        if (searchInputRef.current) {
          // 确保搜索框可见
          searchInputRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    };

    window.addEventListener("resize", handleResize);

    // 在iOS上，使用特殊的可视区域变化事件
    if (typeof window.visualViewport !== "undefined") {
      window.visualViewport.addEventListener("resize", handleResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (typeof window.visualViewport !== "undefined") {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, [isMobile, isFocused]);

  useEffect(() => {
    if (tagSuggestions.length > 0) {
      setCurrentSelectedSuggestion(tagSuggestions[0].toLowerCase());
    } else {
      setCurrentSelectedSuggestion("");
    }
  }, [tagSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        tagSuggestionsRef.current &&
        !tagSuggestionsRef.current.contains(event.target)
      ) {
        setShowTagSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // 动态调整标签建议容器的位置
    const handleTagSuggestionsPosition = () => {
      // 只有当显示标签建议且在移动端时执行
      if (showTagSuggestions && isMobile && tagSuggestionsRef.current) {
        // 计算可视区域高度（考虑输入法占用的空间）
        const visibleHeight = window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;

        // 获取搜索输入框位置
        const inputRect = searchInputRef.current?.getBoundingClientRect();
        if (!inputRect) return;

        const suggestionsEl = tagSuggestionsRef.current;

        // 判断输入框是否在可视区域底部附近
        const inputNearBottom = inputRect.bottom > visibleHeight - 200;

        if (inputNearBottom) {
          // 如果输入框靠近底部，将建议显示在输入框上方
          suggestionsEl.style.position = "absolute";
          suggestionsEl.style.bottom = `${inputRect.height + 10}px`;
          suggestionsEl.style.top = "auto";
          suggestionsEl.style.maxHeight = `${inputRect.top - 20}px`;
        } else {
          // 否则显示在输入框下方
          suggestionsEl.style.position = "absolute";
          suggestionsEl.style.top = `${inputRect.height + 10}px`;
          suggestionsEl.style.bottom = "auto";
          suggestionsEl.style.maxHeight = `${
            visibleHeight - inputRect.bottom - 20
          }px`;
        }
      }
    };

    // 在显示状态改变时调整位置
    if (showTagSuggestions) {
      handleTagSuggestionsPosition();

      // 监听视口变化（输入法弹出时）
      if (typeof window.visualViewport !== "undefined") {
        window.visualViewport.addEventListener(
          "resize",
          handleTagSuggestionsPosition
        );
      } else {
        window.addEventListener("resize", handleTagSuggestionsPosition);
      }
    }

    return () => {
      if (typeof window.visualViewport !== "undefined") {
        window.visualViewport.removeEventListener(
          "resize",
          handleTagSuggestionsPosition
        );
      } else {
        window.removeEventListener("resize", handleTagSuggestionsPosition);
      }
    };
  }, [
    showTagSuggestions,
    isMobile,
    searchInputRef.current,
    tagSuggestionsRef.current,
  ]);

  // 删除标签
  const removeTag = (tagToRemove) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);

    // 重新执行搜索
    if (inputValue.trim().length > 0) {
      performSearch(inputValue.trim(), updatedTags);
    } else if (updatedTags.length > 0) {
      // 还有其他标签
      performSearch("", updatedTags);
    } else {
      // 没有标签和搜索词时，清空结果
      setSearchResults([]);
      setGroupedResults({});
      setResultCounts({ total: 0, byFile: {} });
    }
  };

  // 清除搜索框
  const handleClearSearch = () => {
    setInputValue("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // 如果有标签，保持当前标签搜索结果
    if (tags.length > 0) {
      performSearch("", tags);
    }
  };

  // 清除所有标签和搜索
  const handleClearAll = () => {
    setInputValue("");
    setTags([]);
    setSearchResults([]);
    setGroupedResults({});
    setResultCounts({ total: 0, byFile: {} });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (term) => {
      // Remove the length check - allow any non-empty search term
      if (!term && tags.length === 0) {
        setSearchResults([]);
        setGroupedResults({});
        setResultCounts({ total: 0, byFile: {} });
        setIsSearching(false);
        return;
      }

      performSearch(term, tags);
    }, 500),
    [tables, tags]
  );

  // 当输入值变化时执行搜索
  useEffect(() => {
    debouncedSearch(inputValue);
  }, [inputValue, debouncedSearch]);

  const performSearch = async (term = "", currentTags = tags) => {
    // 不满足搜索条件时退出
    if (!term && currentTags.length === 0) return;

    setIsSearching(true);
    setSearchError(null);
    console.log(
      `[搜索] 搜索词: "${term}"${
        currentTags.length > 0 ? ` 标签: ${currentTags.join(", ")}` : ""
      }`
    );

    try {
      const results = [];
      const grouped = {};
      const counts = { total: 0, byFile: {} };

      // 限制同时处理的表格数，以提高响应性
      const tablesToProcess = [...tables];
      const processedTables = new Set();

      while (tablesToProcess.length > 0 && counts.total < MAX_TOTAL_RESULTS) {
        const currentBatch = tablesToProcess.splice(0, 3); // 每次处理3个表格

        await Promise.all(
          currentBatch.map(async (tableName) => {
            try {
              let tableData;

              // 首先尝试从缓存获取数据
              if (isTableCached(tableName)) {
                console.log(`[搜索] 使用缓存数据搜索: ${tableName}`);
                tableData = getTableFromCache(tableName);
              } else {
                // 缓存中没有，从API获取
                if (isTableLoading(tableName)) {
                  console.log(`[搜索] 表格 ${tableName} 正在加载中，稍后处理`);
                  // 将其放回队列尾部，稍后再处理
                  tablesToProcess.push(tableName);
                  return;
                }

                markTableLoading(tableName);
                console.log(`[搜索] 从API加载表格数据: ${tableName}`);

                try {
                  const apiUrl = `/api/table/${encodeURIComponent(tableName)}`;
                  const response = await fetch(apiUrl);

                  if (!response.ok) {
                    throw new Error(
                      `无法加载表格: ${tableName} (${response.status})`
                    );
                  }

                  const result = await response.json();

                  // 检查 API 返回的格式
                  if (!result.success) {
                    throw new Error(result.message || `加载${tableName}失败`);
                  }

                  tableData = result.data;

                  // 缓存获取到的数据
                  cacheTable(tableName, tableData);
                } finally {
                  clearTableLoading(tableName);
                }
              }

              // 提取实际数据数组
              const tableArray = Array.isArray(tableData)
                ? tableData
                : tableData &&
                  typeof tableData === "object" &&
                  Object.values(tableData)[0];

              // 安全性检查
              if (!tableArray || !Array.isArray(tableArray)) {
                console.warn(`[搜索] 表格 ${tableName} 数据格式无效`);
                return;
              }

              // 过滤有效数据（id >= 0）
              const validData = tableArray.filter(
                (row) =>
                  row &&
                  typeof row === "object" &&
                  row.id !== undefined &&
                  row.id >= 0
              );

              // 如果过滤后没有数据，跳过
              if (!validData || validData.length === 0) {
                console.warn(`[搜索] 表格 ${tableName} 没有有效数据`);
                return;
              }

              // 搜索匹配项
              const tableResults = [];
              counts.byFile[tableName] = 0;

              // 对每一行数据进行搜索
              for (const row of validData) {
                let matched = false;
                let matchField = null;
                let matchValue = null;
                let rowTags = [];

                // 搜索所有字段
                for (const [key, value] of Object.entries(row)) {
                  // 收集标签
                  if (key.match(/^Tag_\d+$/)) {
                    if (value) {
                      rowTags.push(String(value).toLowerCase());
                    }
                    continue;
                  }

                  // 排除ID字段（已单独处理）
                  if (key === "id") continue;

                  // 如果字段值不可用，跳过
                  if (value === null || value === undefined) continue;

                  const stringValue = String(value);

                  // 如果有搜索词，检查是否匹配
                  if (
                    term &&
                    stringValue.toLowerCase().includes(term.toLowerCase())
                  ) {
                    matched = true;
                    // 记录第一个匹配的字段
                    if (!matchField) {
                      matchField = key;
                      matchValue = value;
                    }
                    // 如果找到精确匹配的字段，优先使用
                    if (key.toLowerCase().includes(term.toLowerCase())) {
                      matchField = key;
                      matchValue = value;
                      break; // 找到最佳匹配，可以停止搜索
                    }
                  }
                }

                // 标签过滤
                if (currentTags.length > 0) {
                  // 如果没有任何标签匹配，跳过此行
                  if (!rowTags.some((tag) => currentTags.includes(tag))) {
                    matched = false;
                  }
                }

                // 如果只有标签过滤（无搜索词）
                if (!term && currentTags.length > 0) {
                  if (rowTags.some((tag) => currentTags.includes(tag))) {
                    matched = true;

                    // 不设置 matchField，调用者会展示完整数据
                    if (!matchField) {
                      // 查找一个较好的默认显示字段
                      for (const key of [
                        "text",
                        "content",
                        "name",
                        "title",
                        "description",
                      ]) {
                        if (row[key]) {
                          matchField = key;
                          matchValue = row[key];
                          break;
                        }
                      }

                      // 如果没找到优先字段，使用第一个非ID非标签字段
                      if (!matchField) {
                        for (const key in row) {
                          if (key !== "id" && !key.match(/^Tag_\d+$/)) {
                            matchField = key;
                            matchValue = row[key];
                            break;
                          }
                        }
                      }
                    }
                  }
                }

                // 如果匹配，添加到结果
                if (matched) {
                  tableResults.push({
                    file: tableName,
                    row,
                    matchField,
                    matchValue,
                    tags: rowTags,
                  });

                  counts.byFile[tableName] =
                    (counts.byFile[tableName] || 0) + 1;
                  counts.total++;

                  // 达到文件最大结果数，停止处理
                  if (counts.byFile[tableName] >= MAX_RESULTS_PER_FILE) {
                    break;
                  }

                  // 达到总最大结果数，停止处理
                  if (counts.total >= MAX_TOTAL_RESULTS) {
                    break;
                  }
                }
              }

              // 添加到结果中
              if (tableResults.length > 0) {
                results.push(...tableResults);
                grouped[tableName] = tableResults;
              }

              processedTables.add(tableName);
            } catch (error) {
              console.warn(`[搜索] 处理表格 ${tableName} 时出错:`, error);
            }
          })
        );
      }

      // 更新搜索结果
      setSearchResults(results);
      setGroupedResults(grouped);
      setResultCounts(counts);

      // 默认展开前几个组
      if (Object.keys(grouped).length > 0) {
        setExpandedGroups(Object.keys(grouped).slice(0, 3));
      }

      console.log(
        `[搜索] 在 ${Object.keys(grouped).length} 个表格中找到 ${
          counts.total
        } 条匹配结果`
      );
    } catch (error) {
      console.error("[搜索] 搜索出错:", error);
      setSearchError(`搜索过程中出错: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // 切换组展开状态
  const toggleGroup = (file) => {
    setExpandedGroups((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );
  };

  const handleResultClick = (result, fieldKey, fieldValue) => {
    // 如果提供了字段，则复制字段内容
    if (fieldKey && fieldValue !== undefined) {
      const itemId = `${result.file}-${result.row.id}-${fieldKey}`;
      copyToClipboard(String(fieldValue), itemId);
      return;
    }

    // 否则切换展开/折叠状态
    const itemId = `${result.file}-${result.row.id}`;

    setExpandedItems(
      (prev) =>
        prev.includes(itemId)
          ? prev.filter((id) => id !== itemId) // 折叠
          : [...prev, itemId] // 展开
    );
  };

  const isItemExpanded = (result) => {
    const itemId = `${result.file}-${result.row.id}`;
    return expandedItems.includes(itemId);
  };

  // 提交搜索表单
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim().length > 0 || tags.length > 0) {
      performSearch(inputValue.trim(), tags);
    }
  };

  // 高亮显示匹配文本
  const highlightMatch = (text, search) => {
    if (!search || search.length < 1) return text;

    const parts = String(text).split(new RegExp(`(${search})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <mark key={index} className="highlighted-text">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // 渲染结果组
  const renderResultGroups = () => {
    if (Object.keys(groupedResults).length === 0) {
      if ((inputValue.length > 0 || tags.length > 0) && !isSearching) {
        return (
          <motion.div
            className="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            未找到匹配
            {inputValue.length > 0 ? `"${inputValue}"` : ""}
            {tags.length > 0 && (
              <span>
                {inputValue.length > 0 ? " 且含有标签 " : "含有标签 "}
                {tags.map((tag, i) => (
                  <span key={tag} className="tag-indicator">
                    #{tag}
                    {i < tags.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            )}
            &ensp;的结果
          </motion.div>
        );
      }
      return null;
    }

    return (
      <motion.div
        className="search-result-groups"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {Object.entries(groupedResults).map(([file, results]) => (
          <div key={file} className="result-group">
            <div className="group-header" onClick={() => toggleGroup(file)}>
              <div className="group-title">
                <FiFile className="file-icon" />
                <span>{file.replace(/\.json$/, "")}</span>
              </div>
              <div className="group-meta">
                <span className="result-count">
                  {resultCounts.byFile[file] || 0} 条结果
                </span>
                {expandedGroups.includes(file) ? (
                  <FiChevronUp />
                ) : (
                  <FiChevronDown />
                )}
              </div>
            </div>

            <AnimatePresence>
              {expandedGroups.includes(file) && (
                <motion.div
                  className="group-results"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {results.map((result, index) => {
                    const isExpanded = isItemExpanded(result);

                    return (
                      <motion.div
                        key={`${file}-${index}-${result.row.id}`}
                        className={`result-item ${
                          isExpanded ? "expanded" : ""
                        }`}
                        onClick={() => handleResultClick(result)} // 点击展开/折叠
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        whileHover={{
                          backgroundColor: "rgba(97, 218, 251, 0.08)",
                        }}
                      >
                        {/* 结果摘要部分 */}
                        <div className="result-summary">
                          {/* 显示ID和标签 */}
                          <div className="result-id-header">
                            <span>ID: {result.row.id}</span>
                            {result.tags && result.tags.length > 0 && (
                              <div className="result-tags">
                                <FiTag className="tag-icon" />
                                {result.tags.map((tag, i) => (
                                  <span key={i} className="result-tag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 显示匹配字段作为摘要 */}
                          {result.matchField && (
                            <div
                              className="result-match-summary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResultClick(
                                  result,
                                  result.matchField,
                                  result.matchValue
                                );
                              }}
                            >
                              <div className="result-field">
                                {result.matchField}:
                                {copiedItems[
                                  `${file}-${result.row.id}-${result.matchField}`
                                ] && (
                                  <span className="copied-indicator">
                                    已复制
                                  </span>
                                )}
                              </div>
                              <div className="result-content">
                                {inputValue.length > 0
                                  ? highlightMatch(
                                      String(result.matchValue),
                                      inputValue
                                    )
                                  : String(result.matchValue)}
                              </div>
                            </div>
                          )}

                          {/* 展开/折叠指示器 */}
                          <div
                            className={`expand-indicator ${
                              isExpanded ? "expanded" : ""
                            }`}
                          >
                            {isExpanded ? "收起详情" : "查看完整内容"}
                          </div>
                        </div>

                        {/* 展开后显示的详细内容 */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              className="result-details"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              {/* 显示所有字段 */}
                              {Object.keys(result.row).map((fieldKey) => {
                                // 跳过ID字段，因为已经在头部显示
                                if (fieldKey === "id" || fieldKey === "Tag")
                                  return null;

                                // 如果匹配字段已在摘要中显示，且内容较短，可以跳过
                                if (
                                  fieldKey === result.matchField &&
                                  String(result.matchValue).length < 100 &&
                                  !isExpanded
                                )
                                  return null;

                                const fieldValue = result.row[fieldKey];
                                if (
                                  fieldValue === null ||
                                  fieldValue === undefined
                                )
                                  return null;

                                // 字段唯一ID
                                const fieldId = `${file}-${result.row.id}-${fieldKey}`;

                                return (
                                  <div
                                    key={fieldKey}
                                    className={`result-field-container ${
                                      fieldKey === result.matchField
                                        ? "is-match"
                                        : ""
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResultClick(
                                        result,
                                        fieldKey,
                                        fieldValue
                                      );
                                    }}
                                  >
                                    <div className="result-field">
                                      {fieldKey}:
                                      {copiedItems[fieldId] && (
                                        <span className="copied-indicator">
                                          已复制
                                        </span>
                                      )}
                                    </div>
                                    <div className="result-content">
                                      {fieldKey === result.matchField &&
                                      inputValue.length > 0
                                        ? String(fieldValue)
                                            .split("\n")
                                            .map((line, i) => (
                                              <React.Fragment key={i}>
                                                {highlightMatch(
                                                  line,
                                                  inputValue
                                                )}
                                                {i <
                                                  String(fieldValue).split("\n")
                                                    .length -
                                                    1 && <br />}
                                              </React.Fragment>
                                            ))
                                        : String(fieldValue)
                                            .split("\n")
                                            .map((line, i) => (
                                              <React.Fragment key={i}>
                                                {line}
                                                {i <
                                                  String(fieldValue).split("\n")
                                                    .length -
                                                    1 && <br />}
                                              </React.Fragment>
                                            ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                  {resultCounts.byFile[file] > results.length && (
                    <div className="more-results">
                      还有 {resultCounts.byFile[file] - results.length}{" "}
                      条更多结果未显示
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {resultCounts.total >= MAX_TOTAL_RESULTS && (
          <div className="results-limit-notice">
            结果过多，只显示前 {MAX_TOTAL_RESULTS} 条
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="search-results-summary">
            在 {Object.keys(groupedResults).length} 个文件中找到{" "}
            {resultCounts.total} 条匹配结果
            {tags.length > 0 && (
              <span>
                {" "}
                (已筛选含有
                {tags.map((tag, i) => (
                  <span key={tag} className="tag-indicator">
                    {" "}
                    #{tag}
                    {i < tags.length - 1 ? "，" : ""}
                  </span>
                ))}
                标签的结果)
              </span>
            )}
            &emsp;
            {(inputValue.length >= 2 || tags.length > 0) && (
              <button className="clear-all-button" onClick={handleClearAll}>
                清除全部
              </button>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      className={`global-search-container ${isMobile ? "mobile" : ""} ${
        searchResults.length > 0 || isSearching ? "has-results" : ""
      } ${isFocused ? "has-focus" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {!searchResults.length && !isSearching && (!isMobile || !isFocused) && (
        <motion.div
          className="search-logo"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1>
            Sekai<span>Translate</span>
          </h1>
        </motion.div>
      )}

      <form
        className={`search-form ${
          searchResults.length > 0 || isSearching || isFocused
            ? "results-mode"
            : ""
        }`}
        onSubmit={handleSearchSubmit}
      >
        <div className={`search-input-wrapper ${isFocused ? "focused" : ""}`}>
          <div className="search-inner-container">
            {/* 搜索图标放在左侧固定位置 */}
            <div className="search-icon-wrap">
              <FiSearch className="search-icon" />
            </div>

            {/* 输入框占据中间空间 */}
            <div className="search-input-container">
              <input
                ref={searchInputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="搜索或输入 #标签 后按回车..."
                className="global-search-input"
                onFocus={handleSearchFocus}
                onBlur={() => setIsFocused(false)}
              />
            </div>

            {/* 清除按钮放在右侧 */}
            {inputValue && (
              <div className="clear-button-wrap">
                <button
                  type="button"
                  className="clear-search-button"
                  onClick={handleClearSearch}
                  aria-label="清除搜索"
                >
                  <FiX />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 标签建议下拉框 */}
        {showTagSuggestions && (
          <div className="tag-suggestions-container" ref={tagSuggestionsRef}>
            {isLoadingTags && tagSuggestions.length === 0 ? (
              <div className="tag-suggestions-loading">
                <LoadingIndicator small message="加载标签中..." />
              </div>
            ) : (
              <ul className="tag-suggestions-list">
                {tagSuggestions.length > 0 ? (
                  tagSuggestions.map((tag) => (
                    <li
                      key={tag}
                      className={`tag-suggestion-item ${
                        tag.toLowerCase() === currentSelectedSuggestion
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => selectTagSuggestion(tag)}
                      onMouseEnter={() =>
                        setCurrentSelectedSuggestion(tag.toLowerCase())
                      }
                    >
                      <FiTag className="tag-suggestion-icon" />
                      <span>{tag}</span>
                      {tags.includes(tag.toLowerCase()) && (
                        <span className="tag-already-used">已使用</span>
                      )}
                    </li>
                  ))
                ) : currentTagInput && allTags.length > 0 ? (
                  <li className="tag-no-suggestions">
                    没有匹配"{currentTagInput}"的标签
                  </li>
                ) : (
                  <li className="tag-no-suggestions">未找到标签</li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* 显示添加的标签 */}
        {tags.length > 0 && (
          <div className="search-tags">
            {tags.map((tag) => (
              <div key={tag} className="search-tag">
                <span className="tag-hash">#</span>
                <span className="tag-text">{tag}</span>
                <button
                  className="tag-remove"
                  onClick={() => removeTag(tag)}
                  aria-label="删除标签"
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* {inputValue.length > 0 &&
          inputValue.length < 2 &&
          !inputValue.startsWith("#") && (
            <div className="search-tip">请至少输入2个字符</div>
          )} */}
      </form>

      <div className="search-results-container">
        {searchError && <div className="search-error">{searchError}</div>}

        {isSearching ? (
          <LoadingIndicator message="正在搜索中..." />
        ) : (
          renderResultGroups()
        )}

        {!inputValue &&
          !searchResults.length &&
          !isSearching &&
          tags.length === 0 &&
          (!isMobile || !isFocused) && (
            <motion.div
              className="welcome-instructions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="welcome-message">
                <p>欢迎使用Sekai-Translate!</p>
                <p>请输入关键词以在所有翻译文件中查找内容</p>
                <p>
                  使用 <span className="highlight">#标签</span>{" "}
                  并按回车添加标签过滤
                </p>
              </div>

              <div className="recent-files">
                <h3>快速访问</h3>
                {isLoadingTables ? (
                  <LoadingIndicator small message="加载表格中..." />
                ) : tablesError ? (
                  <div className="tables-error">
                    <p>加载表格失败: {tablesError}</p>
                    <button onClick={() => window.location.reload()}>
                      重试
                    </button>
                  </div>
                ) : (
                  <ul>
                    {tables.slice(0, 5).map((tableName, index) => (
                      <motion.li
                        key={tableName}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                      >
                        <button
                          onClick={() => onTableSelect(tableName)}
                          className="file-shortcut"
                        >
                          <FiDatabase className="shortcut-icon" />
                          <span>{tableName}</span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
      </div>
    </motion.div>
  );
}

export default React.memo(GlobalSearch);
