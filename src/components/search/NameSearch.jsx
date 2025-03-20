import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiX,
  FiTag,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import LoadingIndicator from "../tables/LoadingIndicator.jsx";
import { isJsonCached, getJsonFromCache, cacheJson } from "../../utils/JsonCache.jsx";
import FuzzySearchDict from "../../assets/FuzzySearchDict.json" with { type: "json" };
import { useMediaQuery } from "react-responsive";
import "../../styles/NameSearch.css";

function NameSearch() {
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nameData, setNameData] = useState(null);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  // 搜索状态
  const [caller, setCaller] = useState("");
  const [callee, setCallee] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 移动端分页加载相关状态
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalResults, setTotalResults] = useState([]);
  const bottomObserverRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // 标签相关状态
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [currentTagInput, setCurrentTagInput] = useState("");
  const [currentSelectedSuggestion, setCurrentSelectedSuggestion] =
    useState("");
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [fuzzyDict, setFuzzyDict] = useState({});

  // 用于处理点击外部关闭标签建议
  const tagSuggestionsRef = useRef(null);
  // 标签输入框引用
  const tagInputRef = useRef(null);

  // 结果分组
  const [expandedItems, setExpandedItems] = useState([]);

  useEffect(() => {
    const initFuzzyDict = () => {
      const dict = {};

      // 预处理：为每个角色创建所有可能名称的集合
      FuzzySearchDict.模糊搜索表.forEach((entry) => {
        // 收集同一角色的所有名称变体
        const allNames = [];

        Object.keys(entry).forEach((key) => {
          if (key.startsWith("name_") && entry[key]) {
            allNames.push(entry[key].toLowerCase());
          }
        });

        // 为每个名称变体建立与其他所有变体的对应关系
        allNames.forEach((name) => {
          if (!dict[name]) {
            dict[name] = [];
          }

          // 将所有变体（包括自己）添加到映射中
          allNames.forEach((variant) => {
            if (!dict[name].includes(variant)) {
              dict[name].push(variant);
            }
          });
        });
      });

      setFuzzyDict(dict);
    };

    initFuzzyDict();
  }, []);

  useEffect(() => {
    const loadNameData = async () => {
      try {
        setIsLoading(true);

        const fileName = "人称表.json";
        let data;

        // 尝试从缓存获取
        if (isJsonCached(fileName)) {
          data = getJsonFromCache(fileName);
        } else {
          try {
            // 修改为从API加载数据
            const apiUrl = `/api/get-json/${encodeURIComponent(fileName)}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
              throw new Error(`无法加载人称表文件: ${response.status}`);
            }

            const result = await response.json();

            // 检查API返回的格式
            if (!result.success) {
              throw new Error(result.message || "加载人称表数据失败");
            }

            data = result.data;

            if (!data || typeof data !== "object") {
              throw new Error("人称表数据格式无效");
            }

            // 缓存有效数据
            cacheJson(fileName, data);
          } catch (error) {
            console.error(`加载人称表数据出错:`, error);
            throw error;
          }
        }

        // 验证数据格式
        if (!data || !data["人称表"] || !Array.isArray(data["人称表"])) {
          throw new Error("人称表数据格式不正确");
        }

        setNameData(data);

        // 提取所有可用的标签
        if (data["人称表"].length > 0) {
          try {
            const uniqueTags = new Set();

            data["人称表"].forEach((entry) => {
              if (!entry || typeof entry !== "object") return;

              // 收集标签
              Object.keys(entry).forEach((key) => {
                if (key.match(/^Tag_\d+$/) && entry[key]) {
                  uniqueTags.add(String(entry[key]).toLowerCase());
                }
              });
            });

            setAllTags(Array.from(uniqueTags).sort());
          } catch (err) {
            console.warn("提取标签时出错:", err);
            // 不影响主要功能，继续执行
          }
        }

        setError(null);
      } catch (err) {
        console.error("加载人称表数据出错:", err);
        setError(`无法加载人称表数据: ${err.message}`);
        setNameData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadNameData();
  }, []);

  const handleSearch = useCallback(() => {
    if (
      !nameData ||
      !nameData["人称表"] ||
      !Array.isArray(nameData["人称表"])
    ) {
      setSearchResults([]);
      setTotalResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const tableData = nameData["人称表"];
      let results = [];

      const fuzzyMatchCaller = (name) => {
        if (!caller.trim() || !name) return true;
        const input = caller.toLowerCase();
        const nameLower = typeof name === "string" ? name.toLowerCase() : "";

        // 1. 直接匹配原名
        if (nameLower.includes(input)) return true;

        // 2. 检查所有可能的别名 - 任何变体匹配都返回true
        for (const alias in fuzzyDict) {
          try {
            // 如果某个别名包含输入的文本
            if (alias.includes(input)) {
              // 检查该别名的所有变体是否包含当前名称
              const variants = fuzzyDict[alias] || [];
              if (
                variants.some(
                  (variant) =>
                    variant === nameLower || nameLower.includes(variant)
                )
              ) {
                return true;
              }
            }
          } catch (err) {
            console.warn("模糊匹配称呼者时出错:", err);
          }
        }

        return false;
      };

      const fuzzyMatchCallee = (name) => {
        if (!callee.trim() || !name) return true;
        const input = callee.toLowerCase();
        const nameLower = typeof name === "string" ? name.toLowerCase() : "";

        // 1. 直接匹配原名
        if (nameLower.includes(input)) return true;

        // 2. 检查所有可能的别名 - 任何变体匹配都返回true
        for (const alias in fuzzyDict) {
          try {
            // 如果某个别名包含输入的文本
            if (alias.includes(input)) {
              // 检查该别名的所有变体是否包含当前名称
              const variants = fuzzyDict[alias] || [];
              if (
                variants.some(
                  (variant) =>
                    variant === nameLower || nameLower.includes(variant)
                )
              ) {
                return true;
              }
            }
          } catch (err) {
            console.warn("模糊匹配被称者时出错:", err);
          }
        }

        return false;
      };

      // 筛选匹配记录
      try {
        results = tableData.filter((entry) => {
          if (!entry || typeof entry !== "object") return false;

          // 名称匹配条件
          const callerMatch = fuzzyMatchCaller(entry["称呼者"]);
          const calleeMatch = fuzzyMatchCallee(entry["被称者"]);

          // 标签匹配条件
          let tagMatch = true;
          if (tags.length > 0) {
            try {
              const entryTags = [];
              Object.keys(entry).forEach((key) => {
                if (key.match(/^Tag_\d+$/) && entry[key]) {
                  entryTags.push(String(entry[key]).toLowerCase());
                }
              });
              tagMatch = tags.every((tag) =>
                entryTags.includes(tag.toLowerCase())
              );
            } catch (err) {
              console.warn("标签匹配时出错:", err);
              tagMatch = false;
            }
          }

          return callerMatch && calleeMatch && tagMatch;
        });
      } catch (err) {
        console.error("过滤记录时出错:", err);
        results = [];
      }

      // 保存总结果，以便分页处理
      setTotalResults(Array.isArray(results) ? results : []);

      // 移动端仅显示部分结果
      if (isMobile) {
        setSearchResults(
          Array.isArray(results) ? results.slice(0, displayCount) : []
        );
      } else {
        setSearchResults(Array.isArray(results) ? results : []);
      }
    } catch (err) {
      console.error("搜索出错:", err);
      setSearchResults([]);
      setTotalResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [nameData, caller, callee, tags, fuzzyDict, displayCount, isMobile]);

  // 加载更多结果的处理函数
  const loadMoreItems = useCallback(() => {
    if (isLoadingMore || !isMobile) return;
    if (displayCount >= totalResults.length) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      const newCount = Math.min(displayCount + 50, totalResults.length);
      setDisplayCount(newCount);
      setSearchResults(totalResults.slice(0, newCount));
      setIsLoadingMore(false);
    }, 300); // 添加一些延迟，使加载更平滑
  }, [displayCount, totalResults, isLoadingMore, isMobile]);

  // 设置滚动观察器用于自动加载更多
  useEffect(() => {
    if (!isMobile || !bottomObserverRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(bottomObserverRef.current);

    return () => {
      if (bottomObserverRef.current) {
        observer.unobserve(bottomObserverRef.current);
      }
    };
  }, [isMobile, loadMoreItems]);

  // 当搜索条件改变时重置显示数量
  useEffect(() => {
    if (isMobile) {
      setDisplayCount(50);
    }
  }, [caller, callee, tags, isMobile]);

  // 处理称呼者输入变化
  const handleCallerChange = (e) => {
    setCaller(e.target.value);
    // 如果有任何输入值，自动设置为已搜索状态
    if (e.target.value.trim() || callee.trim() || tags.length > 0) {
      setHasSearched(true);
    }
  };

  // 处理被称者输入变化
  const handleCalleeChange = (e) => {
    setCallee(e.target.value);
    // 如果有任何输入值，自动设置为已搜索状态
    if (caller.trim() || e.target.value.trim() || tags.length > 0) {
      setHasSearched(true);
    }
  };

  // 使用防抖自动搜索
  useEffect(() => {
    if (!nameData) return;

    // 如果有搜索条件，设为已搜索状态
    if (caller.trim() || callee.trim() || tags.length > 0) {
      setHasSearched(true);
    }

    // 使用防抖，延迟300ms再搜索，避免频繁搜索
    const timer = setTimeout(() => {
      if (hasSearched) {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [caller, callee, tags, nameData, handleSearch, hasSearched]);

  const handleTagInputChange = (e) => {
    const value = e.target.value;

    // 始终保存不带#的值到状态中
    const tagText = value.startsWith("#") ? value.substring(1) : value;
    setCurrentTagInput(tagText.toLowerCase());

    // 过滤并显示标签建议 (无论是否有#都可以显示建议)
    if (allTags.length > 0 && value.trim()) {
      const suggestions = allTags
        .filter((tag) => tag.toLowerCase().includes(tagText.toLowerCase()))
        .filter((tag) => !tags.includes(tag.toLowerCase()))
        .slice(0, 10);

      setTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setTagSuggestions([]);
      setShowTagSuggestions(false);
    }
  };

  const selectTagSuggestion = (tag) => {
    // 添加标签
    if (!tags.includes(tag.toLowerCase())) {
      const newTags = [...tags, tag.toLowerCase()];
      setTags(newTags);
      setHasSearched(true);
    }

    // 清空输入和状态
    if (tagInputRef.current) {
      tagInputRef.current.value = "";
    }
    setCurrentTagInput("");
    setShowTagSuggestions(false);
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (showTagSuggestions && currentSelectedSuggestion) {
        // 有选中的建议，使用选中的建议
        selectTagSuggestion(currentSelectedSuggestion);
      } else if (tagSuggestions.length > 0) {
        // 没有选中的建议但有建议列表，使用第一个建议
        selectTagSuggestion(tagSuggestions[0]);
      } else {
        // 没有建议但有输入，使用输入的内容
        selectTagSuggestion(currentTagInput.trim());
      }
      return;
    }

    // 处理上下键导航标签
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

      if (e.key === "Tab") {
        e.preventDefault();
        if (tagSuggestions.length > 0) {
          selectTagSuggestion(
            currentSelectedSuggestion || tagSuggestions[0].toLowerCase()
          );
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowTagSuggestions(false);
        return;
      }
    }
  };

  // 删除标签
  const removeTag = (tagToRemove) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);
  };

  // 清除所有筛选条件
  const handleClearAll = () => {
    setCaller("");
    setCallee("");
    setTags([]);
    setSearchResults([]);
    setHasSearched(false);
    setDisplayCount(50);
  };

  // 点击切换展开/折叠结果项
  const toggleResultItem = (id) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 处理点击标签建议外部以关闭
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
    if (tagSuggestions.length > 0) {
      setCurrentSelectedSuggestion(tagSuggestions[0].toLowerCase());
    } else {
      setCurrentSelectedSuggestion("");
    }
  }, [tagSuggestions]);

  if (isLoading) {
    return (
      <div className="ns-name-search-loading">
        <LoadingIndicator message="正在加载人称表数据..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ns-name-search-error">
        <FiAlertCircle size={32} />
        <h3>无法加载人称表</h3>
        <p>{error}</p>
        <p>人名检索功能依赖于"人称表.json"文件，请确保此文件存在且格式正确。</p>
      </div>
    );
  }

  // 渲染结果摘要信息
  const renderResultsSummary = () => {
    if (!hasSearched || searchResults.length === 0) return null;

    if (isMobile) {
      return `显示 ${Math.min(displayCount, totalResults.length)} / ${
        totalResults.length
      } 条结果`;
    } else {
      return `找到 ${searchResults.length} 条结果`;
    }
  };

  return (
    <motion.div
      className="name-search-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="name-search-header">
        <h2>人名检索</h2>
        <p className="name-search-description">
          支持模糊匹配。
          <br />
          例如，称呼者为"星乃一歌"，被称者为"朝比奈まふゆ"。
          <br />
          可以输入"星乃"和"mfy"进行搜索。
        </p>
      </div>

      <div className="name-search-form">
        <div className="ns-search-row">
          <div className="ns-search-field">
            <label htmlFor="caller">称呼者:</label>
            <div className="ns-input-wrapper">
              <FiSearch className="ns-search-icon" />
              <input
                id="caller"
                type="text"
                value={caller}
                onChange={handleCallerChange}
                placeholder="输入角色名称"
              />
              {caller && (
                <button
                  className="ns-clear-input"
                  onClick={() => setCaller("")}
                  aria-label="清除称呼者"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="ns-search-field">
            <label htmlFor="callee">被称者:</label>
            <div className="ns-input-wrapper">
              <FiSearch className="ns-search-icon" />
              <input
                id="callee"
                type="text"
                value={callee}
                onChange={handleCalleeChange}
                placeholder="输入角色名称"
              />
              {callee && (
                <button
                  className="ns-clear-input"
                  onClick={() => setCallee("")}
                  aria-label="清除被称者"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="ns-tag-row">
          <div className="ns-tag-field">
            <label htmlFor="tag-input">标签筛选:</label>
            <div className="ns-input-wrapper ns-tag-input-wrapper">
              <FiTag className="ns-tag-icon" />
              <input
                id="tag-input"
                ref={tagInputRef}
                type="text"
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                placeholder="#输入标签名称"
              />

              {/* 标签建议下拉框 */}
              {showTagSuggestions && (
                <div
                  className="ns-tag-suggestions-container"
                  ref={tagSuggestionsRef}
                >
                  {isLoadingTags ? (
                    <div className="ns-tag-suggestions-loading">
                      <LoadingIndicator small message="加载标签中..." />
                    </div>
                  ) : (
                    <ul className="ns-tag-suggestions-list">
                      {tagSuggestions.length > 0 ? (
                        tagSuggestions.map((tag) => (
                          <li
                            key={tag}
                            className={`ns-tag-suggestion-item ${
                              tag.toLowerCase() === currentSelectedSuggestion
                                ? "ns-selected"
                                : ""
                            }`}
                            onClick={() => selectTagSuggestion(tag)}
                            onMouseEnter={() => {
                              setCurrentSelectedSuggestion(tag.toLowerCase());
                            }}
                          >
                            <FiTag className="ns-tag-suggestion-icon" />
                            <span>{tag}</span>
                            {tags.includes(tag.toLowerCase()) && (
                              <span className="ns-tag-already-used">
                                已使用
                              </span>
                            )}
                          </li>
                        ))
                      ) : currentTagInput ? (
                        <li className="ns-tag-no-suggestions">
                          没有匹配"{currentTagInput}"的标签
                        </li>
                      ) : (
                        <li className="ns-tag-no-suggestions">未找到标签</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 清除按钮 */}
          {(caller || callee || tags.length > 0) && (
            <button className="ns-clear-button" onClick={handleClearAll}>
              清除
            </button>
          )}
        </div>

        {/* 显示已添加的标签 */}
        {tags.length > 0 && (
          <div className="ns-search-tags">
            {tags.map((tag) => (
              <div key={tag} className="ns-search-tag">
                <span className="ns-tag-hash">#</span>
                <span className="ns-tag-text">{tag}</span>
                <button
                  className="ns-tag-remove"
                  onClick={() => removeTag(tag)}
                  aria-label="删除标签"
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 搜索结果区域 */}
      <div className="name-search-results" ref={resultsContainerRef}>
        {isSearching ? (
          <LoadingIndicator message="正在搜索..." />
        ) : hasSearched ? (
          searchResults.length > 0 ? (
            <>
              <div className="ns-results-summary">{renderResultsSummary()}</div>

              <div className="ns-results-list">
                {searchResults.map((result) => {
                  const isExpanded = expandedItems.includes(result.id);

                  // 收集标签
                  const resultTags = [];
                  Object.keys(result).forEach((key) => {
                    if (key.match(/^Tag_\d+$/) && result[key]) {
                      resultTags.push(result[key]);
                    }
                  });

                  return (
                    <div
                      key={result.id}
                      className={`ns-result-item ${
                        isExpanded ? "ns-expanded" : ""
                      }`}
                      onClick={() => toggleResultItem(result.id)}
                    >
                      <div className="ns-result-header">
                        <div className="ns-name-container">
                          <span className="ns-caller-name">
                            {result.称呼者}
                          </span>
                          <span className="ns-arrow">→</span>
                          <span className="ns-callee-name">
                            {result.被称者}
                          </span>
                        </div>

                        {result.原文 && result.译文 ? (
                          <div className="ns-term-container">
                            <span className="ns-original-term">
                              {result.原文}
                            </span>
                            <span className="ns-term-separator">→</span>
                            <span className="ns-translated-term">
                              {result.译文}
                            </span>
                          </div>
                        ) : (
                          <div className="ns-term-container ns-missing">
                            <span>未填写称呼</span>
                          </div>
                        )}

                        <div className="ns-result-controls">
                          <button className="ns-expand-button">
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="ns-result-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="ns-detail-row">
                              <span className="ns-detail-label">ID:</span>
                              <span className="ns-detail-value">
                                {result.id}
                              </span>
                            </div>

                            {resultTags.length > 0 && (
                              <div className="ns-detail-row">
                                <span className="ns-detail-label">标签:</span>
                                <div className="ns-detail-tags">
                                  {resultTags.map((tag, index) => (
                                    <span key={index} className="ns-detail-tag">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* 移动端加载更多提示 */}
                {isMobile && totalResults.length > displayCount && (
                  <div className="ns-mobile-load-more" ref={bottomObserverRef}>
                    {isLoadingMore ? (
                      <LoadingIndicator small message="加载更多内容中..." />
                    ) : (
                      <div>向下滑动加载更多</div>
                    )}
                  </div>
                )}

                {/* 显示全部已加载完成提示 */}
                {isMobile &&
                  displayCount >= totalResults.length &&
                  displayCount > 50 && (
                    <div className="ns-mobile-load-more ns-all-loaded">
                      已显示全部 {totalResults.length} 条结果
                    </div>
                  )}
              </div>
            </>
          ) : (
            <div className="ns-no-results">
              <FiAlertCircle size={24} />
              <p>未找到匹配结果</p>
              {(caller || callee || tags.length > 0) && (
                <p className="ns-hint">尝试减少筛选条件或使用不同的关键词</p>
              )}
            </div>
          )
        ) : (
          <div className="ns-search-placeholder">
            <FiSearch size={32} opacity={0.5} />
            <p>请输入搜索条件以查找角色间的称呼方式</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default React.memo(NameSearch);
