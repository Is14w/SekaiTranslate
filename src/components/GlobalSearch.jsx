import React, { useState, useEffect, useCallback, useRef } from "react";
// eslint-disable-next-line
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiFile,
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiTag,
} from "react-icons/fi";
import LoadingIndicator from "./LoadingIndicator";
import { isJsonCached, getJsonFromCache, cacheJson } from "../utils/JsonCache";
import "../styles/GlobalSearch.css";

function GlobalSearch({ jsonFiles, onFileSelect, isMobile }) {
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

  // 输入框引用
  const searchInputRef = useRef(null);

  // 设置最大结果限制
  const MAX_RESULTS_PER_FILE = isMobile ? 20 : 50;
  const MAX_TOTAL_RESULTS = isMobile ? 100 : 300;

  // 加载所有可用的标签
  const loadAllTags = useCallback(async () => {
    if (allTags.length > 0 || isLoadingTags || jsonFiles.length === 0) return;

    setIsLoadingTags(true);

    try {
      const uniqueTags = new Set();

      // 每次处理少量文件，避免阻塞主线程
      const batchSize = 5;

      for (let i = 0; i < jsonFiles.length; i += batchSize) {
        const batch = jsonFiles.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (file) => {
            try {
              let jsonData;

              // 从缓存获取或从服务器加载
              if (isJsonCached(file)) {
                jsonData = getJsonFromCache(file);
              } else {
                const response = await fetch(`/assets/${file}`);
                if (!response.ok) return;

                jsonData = await response.json();
                cacheJson(file, jsonData);
              }

              const tableName = Object.keys(jsonData)[0];
              if (!tableName) return;

              const tableData = jsonData[tableName];
              if (!tableData || !Array.isArray(tableData)) return;

              // 提取所有标签
              tableData.forEach((row) => {
                if (row.Tag) {
                  String(row.Tag)
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag) // 过滤空标签
                    .forEach((tag) => uniqueTags.add(tag.toLowerCase()));
                }
              });
            } catch (error) {
              console.warn(`读取文件 ${file} 标签时出错:`, error);
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
    } catch (error) {
      console.error("加载标签时出错:", error);
    } finally {
      setIsLoadingTags(false);
    }
  }, [jsonFiles, allTags, isLoadingTags]);

  // 组件挂载或 jsonFiles 改变时加载标签
  useEffect(() => {
    if (jsonFiles.length > 0) {
      loadAllTags();
    }
  }, [jsonFiles, loadAllTags]);

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

    // 添加标签到列表
    const newTags = [...new Set([...tags, tag.toLowerCase()])];
    setTags(newTags);

    // 保持光标在输入框
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();

        // 执行搜索
        const cleanInput = newInputValue.trim();
        if (cleanInput.length >= 2) {
          performSearch(cleanInput, newTags);
        } else {
          performSearch("", newTags);
        }
      }
    }, 0);
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
        if (newInputValue.length >= 2) {
          // 有文本和标签
          performSearch(newInputValue, newTags);
        } else {
          // 只有标签
          performSearch("", newTags);
        }
      } else if (inputValue.trim().length >= 2) {
        // 无新标签但有有效的搜索词
        performSearch(inputValue.trim(), tags);
      }
    }
  };

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

  // 删除标签
  const removeTag = (tagToRemove) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);

    // 重新执行搜索
    if (inputValue.trim().length >= 2) {
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

  // 防抖处理搜索
  const debouncedSearch = useCallback(
    debounce(async (term) => {
      // 输入值太短且没有标签时，不执行搜索
      if ((!term || term.trim().length < 2) && tags.length === 0) {
        setSearchResults([]);
        setGroupedResults({});
        setResultCounts({ total: 0, byFile: {} });
        setIsSearching(false);
        return;
      }

      performSearch(term, tags);
    }, 500),
    [jsonFiles, tags]
  );

  // 当输入值变化时执行搜索
  useEffect(() => {
    debouncedSearch(inputValue);
  }, [inputValue, debouncedSearch]);

  // 执行实际搜索
  const performSearch = async (term = "", currentTags = tags) => {
    // 不满足搜索条件时退出
    if ((!term || term.length < 2) && currentTags.length === 0) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = [];
      const grouped = {};
      const counts = { total: 0, byFile: {} };
      const lowercasedTerm = term.toLowerCase();
      const hasTagFilter = currentTags.length > 0;

      // 限制同时处理的文件数，以提高响应性
      const filesToProcess = [...jsonFiles];
      const processedFiles = new Set();

      while (filesToProcess.length > 0 && counts.total < MAX_TOTAL_RESULTS) {
        const currentBatch = filesToProcess.splice(0, 3); // 每次处理3个文件

        await Promise.all(
          currentBatch.map(async (file) => {
            try {
              let jsonData;

              // 检查缓存
              if (isJsonCached(file)) {
                jsonData = getJsonFromCache(file);
              } else {
                // 从服务器加载
                const response = await fetch(`/assets/${file}`);
                if (!response.ok) {
                  throw new Error(`无法加载文件: ${file}`);
                }

                jsonData = await response.json();
                cacheJson(file, jsonData);
              }

              // 获取表名
              const tableName = Object.keys(jsonData)[0];
              if (!tableName) return;

              // 获取表数据
              const tableData = jsonData[tableName];
              if (!tableData || !Array.isArray(tableData)) return;

              // 过滤有效数据（id >= 0）
              const validData = tableData.filter((row) => row.id >= 0);

              // 搜索匹配项
              const fileResults = [];
              counts.byFile[file] = 0;

              for (const row of validData) {
                // 检查此文件的结果是否已达到上限
                if (counts.byFile[file] >= MAX_RESULTS_PER_FILE) break;

                // 先检查标签过滤条件
                let tagMatched = !hasTagFilter;

                // 如果有标签过滤条件，检查是否匹配
                if (hasTagFilter && row.Tag) {
                  const rowTags = String(row.Tag)
                    .toLowerCase()
                    .split(",")
                    .map((t) => t.trim());

                  // 检查是否所有搜索标签都在行标签中
                  tagMatched = currentTags.every((tag) =>
                    rowTags.includes(tag.toLowerCase())
                  );
                }

                // 如果标签不匹配，跳过此行
                if (!tagMatched) continue;

                // 是否有文本搜索
                let textMatched = lowercasedTerm.length < 2; // 如果搜索词太短，视为没有文本搜索
                let matchField = null;
                let matchValue = null;

                // 文本搜索
                if (lowercasedTerm.length >= 2) {
                  // 搜索所有字段，但排除id和Tag字段
                  for (const key in row) {
                    if (key === "id" || key === "Tag") continue; // 排除id和Tag字段

                    const value = row[key];
                    if (value === null || value === undefined) continue;

                    const strValue = String(value).toLowerCase();
                    if (strValue.includes(lowercasedTerm)) {
                      // 找到匹配项
                      textMatched = true;
                      matchField = key;
                      matchValue = value;
                      break;
                    }
                  }
                }

                // 如果同时满足标签和文本搜索条件
                if (tagMatched && textMatched) {
                  fileResults.push({
                    file,
                    tableName,
                    row,
                    matchField, // 可能为null，如果只有标签匹配
                    matchValue, // 可能为null，如果只有标签匹配
                    displayName: file.replace(/\.json$/, ""),
                  });

                  counts.byFile[file] = (counts.byFile[file] || 0) + 1;
                  counts.total++;
                }

                // 检查总结果数是否已达到上限
                if (counts.total >= MAX_TOTAL_RESULTS) break;
              }

              // 添加到结果中
              if (fileResults.length > 0) {
                results.push(...fileResults);
                grouped[file] = fileResults;

                // 默认展开前三个有结果的组
                if (
                  expandedGroups.length < 3 &&
                  !expandedGroups.includes(file)
                ) {
                  setExpandedGroups((prev) => [...prev, file]);
                }
              }

              processedFiles.add(file);
            } catch (error) {
              console.warn(`处理文件 ${file} 时出错:`, error);
            }
          })
        );
      }

      // 更新结果
      setSearchResults(results);
      setGroupedResults(grouped);
      setResultCounts(counts);
    } catch (error) {
      console.error("搜索出错:", error);
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

  // 处理点击结果项
  const handleResultClick = (result) => {
    onFileSelect(result.file);
  };

  // 提交搜索表单
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim().length >= 2 || tags.length > 0) {
      performSearch(inputValue.trim(), tags);
    }
  };

  // 高亮显示匹配文本
  const highlightMatch = (text, search) => {
    if (!search || search.length < 2) return text;

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
      if ((inputValue.length >= 2 || tags.length > 0) && !isSearching) {
        return (
          <motion.div
            className="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            未找到匹配
            {inputValue.length >= 2 ? `"${inputValue}"` : ""}
            {tags.length > 0 && (
              <span>
                {inputValue.length >= 2 ? " 且含有标签 " : "含有标签 "}
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
                  {results.map((result, index) => (
                    <motion.div
                      key={`${file}-${index}-${result.row.id}`}
                      className="result-item"
                      onClick={() => handleResultClick(result)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      whileHover={{
                        backgroundColor: "rgba(97, 218, 251, 0.12)",
                      }}
                    >
                      {/* 显示ID和标签 */}
                      <div className="result-id-header">
                        <span>ID: {result.row.id}</span>
                        {result.row.Tag && (
                          <div className="result-tags">
                            <FiTag className="tag-icon" />
                            {String(result.row.Tag)
                              .split(",")
                              .map((tag, i) => (
                                <span key={i} className="result-tag">
                                  {tag.trim()}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* 完整显示所有字段 */}
                      {Object.keys(result.row).map((fieldKey) => {
                        // 跳过ID和Tag字段，因为已经在头部显示
                        if (fieldKey === "id" || fieldKey === "Tag")
                          return null;

                        const fieldValue = result.row[fieldKey];
                        if (fieldValue === null || fieldValue === undefined)
                          return null;

                        // 确定该字段是否为匹配字段
                        const isMatchField = fieldKey === result.matchField;

                        return (
                          <div
                            key={fieldKey}
                            className={`result-field-container ${
                              isMatchField ? "is-match" : ""
                            }`}
                          >
                            <div className="result-field">{fieldKey}:</div>
                            <div className="result-content">
                              {isMatchField && inputValue.length >= 2
                                ? // 如果是匹配字段且有搜索词，高亮显示匹配部分
                                  String(fieldValue)
                                    .split("\n")
                                    .map((line, i) => (
                                      <React.Fragment key={i}>
                                        {highlightMatch(line, inputValue)}
                                        {i <
                                          String(fieldValue).split("\n")
                                            .length -
                                            1 && <br />}
                                      </React.Fragment>
                                    ))
                                : // 否则正常显示
                                  String(fieldValue)
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
                  ))}

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
                    {i < tags.length - 1 ? "," : ""}
                  </span>
                ))}
                标签的结果)
              </span>
            )}
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
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Google风格的居中Logo */}
      {!searchResults.length && !isSearching && (
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
                onFocus={() => setIsFocused(true)}
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

        {inputValue.length > 0 &&
          inputValue.length < 2 &&
          !inputValue.startsWith("#") && (
            <div className="search-tip">请至少输入2个字符</div>
          )}
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
          tags.length === 0 && (
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
                <ul>
                  {jsonFiles.slice(0, 5).map((file, index) => (
                    <motion.li
                      key={file}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                    >
                      <button
                        onClick={() => onFileSelect(file)}
                        className="file-shortcut"
                      >
                        <FiFile className="shortcut-icon" />
                        <span>{file.replace(/\.json$/, "")}</span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
      </div>
    </motion.div>
  );
}

export default GlobalSearch;
