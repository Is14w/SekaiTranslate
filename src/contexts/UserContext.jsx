import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 检查本地存储中的用户信息
  useEffect(() => {
    // 修改为与应用其他部分一致的键名
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user info:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  }, []);

  // 登录函数
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    
    // 修改为与应用其他部分一致的键名
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // 登出函数
  const logout = () => {
    setUser(null);
    setToken(null);
    
    // 修改为与应用其他部分一致的键名
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // 更新用户信息
  const updateUserInfo = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem('user', JSON.stringify(newUserData));
  };

  const value = {
    user,
    token,
    isLoggedIn: !!user,
    isAdmin: user?.isAdmin || false,
    loading,
    login,
    logout,
    updateUserInfo,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}