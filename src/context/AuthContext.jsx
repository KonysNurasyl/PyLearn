import { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

const getStoredAuth = () => {
  const emptyAuth = { user: null, token: null };

  if (typeof window === 'undefined') return emptyAuth;

  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('token');

  if (!storedUser || !storedToken) return emptyAuth;

  try {
    return { user: JSON.parse(storedUser), token: storedToken };
  } catch (e) {
    console.error('Деректерді оқуда қате:', e);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return emptyAuth;
  }
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth);
  const { user, token } = auth;
  const loading = false;

  const login = (userData, authToken) => {
    setAuth({ user: userData, token: authToken });
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  const logout = () => {
    setAuth({ user: null, token: null });
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
