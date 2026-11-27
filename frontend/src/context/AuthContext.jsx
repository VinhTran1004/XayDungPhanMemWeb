import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('studio_token') || null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const { showToast } = useToast();

  // Khôi phục phiên đăng nhập khi load trang
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await authApi.getMe();
        if (res.success && res.data?.user) {
          setUser(res.data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Lỗi khôi phục phiên đăng nhập:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (email, matKhau) => {
    try {
      const res = await authApi.login({ email, mat_khau: matKhau });
      if (res.success && res.data?.token) {
        localStorage.setItem('studio_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        showToast(`Đăng nhập thành công! Chào mừng ${res.data.user.ho_ten}`, 'success');
        setIsAuthModalOpen(false);
        return res.data;
      }
      throw new Error(res.message || 'Đăng nhập thất bại');
    } catch (err) {
      showToast(err.message || 'Sai email hoặc mật khẩu', 'error');
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const res = await authApi.register(formData);
      if (res.success && res.data?.token) {
        localStorage.setItem('studio_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        showToast('Đăng ký tài khoản thành công!', 'success');
        setIsAuthModalOpen(false);
        return res.data;
      }
      throw new Error(res.message || 'Đăng ký thất bại');
    } catch (err) {
      showToast(err.message || 'Không thể đăng ký tài khoản', 'error');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('studio_token');
    setToken(null);
    setUser(null);
    showToast('Đã đăng xuất tài khoản', 'info');
  };

  const openAuthModal = (tab = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const isAdmin = user?.vai_tro === 'quan_tri_vien';
  const isPhotographer = user?.vai_tro === 'tho_chup';
  const isCustomer = user?.vai_tro === 'khach_hang';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        isPhotographer,
        isCustomer,
        login,
        register,
        logout,
        isAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
