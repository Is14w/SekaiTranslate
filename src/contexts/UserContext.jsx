import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check local storage for user info
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        // Check if token is expired before restoring the session
        const isTokenExpired = checkIfTokenExpired(storedToken);
        
        if (isTokenExpired) {
          // Token expired, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to parse stored user info:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  }, []);

  // Function to check if JWT token is expired
  const checkIfTokenExpired = (token) => {
    try {
      // Get payload part of JWT (second part)
      const payload = token.split('.')[1];
      // Decode base64
      const decodedPayload = atob(payload);
      // Parse JSON
      const payloadData = JSON.parse(decodedPayload);
      
      // Check expiration (exp is in seconds)
      if (payloadData.exp) {
        return payloadData.exp * 1000 < Date.now();
      }
      return false;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // If there's an error, assume token is invalid
    }
  };

  // Add token expiration check to any API request
  const handleApiResponse = (response) => {
    // If unauthorized response and user is logged in, log out
    if (response.status === 401 && user) {
      console.log('Token expired or invalid, logging out');
      logout();
    }
    return response;
  };

  // Login function
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Update user info
  const updateUserInfo = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem('user', JSON.stringify(newUserData));
  };

  // Create an authenticated fetch wrapper
  const authFetch = async (url, options = {}) => {
    if (token) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`
      };
    }

    const response = await fetch(url, options);
    return handleApiResponse(response);
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
    authFetch, // Export the authenticated fetch function
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}