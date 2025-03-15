import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";

// 创建主题上下文
const ThemeContext = createContext();

// 主题提供者组件
export function ThemeProvider({ children }) {
  // 检测系统主题偏好
  const getSystemTheme = () => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  // 从localStorage中获取主题设置，如果没有则跟随系统
  const [theme, setTheme] = useState(() => {
    // 仅在挂载时运行一次
    try {
      const savedTheme = localStorage.getItem("theme");
      return savedTheme || getSystemTheme();
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      return getSystemTheme();
    }
  });

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // 如果用户没有明确设置主题（localStorage中没有保存），则跟随系统
      if (!localStorage.getItem("theme")) {
        setTheme(getSystemTheme());
      }
    };

    // 为主题变化添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // 兼容旧版浏览器
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        // 兼容旧版浏览器
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // 当主题变化时，更新document类名和localStorage，使用useEffect优化
  useEffect(() => {
    // 优化1: 批量处理DOM操作
    const html = document.documentElement;
    const body = document.body;

    // 首先移除所有主题类
    html.classList.remove("dark-theme", "light-theme");
    body.classList.remove("dark-theme", "light-theme");

    // 然后添加当前主题类
    html.classList.add(`${theme}-theme`);
    body.classList.add(`${theme}-theme`);

    // 异步存储到localStorage以避免阻塞渲染
    requestAnimationFrame(() => {
      try {
        localStorage.setItem("theme", theme);
      } catch (error) {
        console.error("Error writing to localStorage:", error);
      }
    });
  }, [theme]);

  // 优化2: 使用useCallback优化切换主题函数
  const toggleTheme = React.useCallback(() => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === "dark" ? "light" : "dark";
      return newTheme;
    });
  }, []);

  // 增加一个清除用户主题偏好的功能，恢复跟随系统
  const resetToSystemTheme = React.useCallback(() => {
    try {
      localStorage.removeItem("theme");
      setTheme(getSystemTheme());
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }
  }, []);

  // 优化3: 使用useMemo缓存上下文值，避免不必要的重渲染
  const contextValue = useMemo(
    () => ({ theme, toggleTheme, resetToSystemTheme }),
    [theme, toggleTheme, resetToSystemTheme]
  );

  // 提供上下文值
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// 自定义hook以便组件使用主题上下文
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
