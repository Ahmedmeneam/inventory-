import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types/auth.ts';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  isIdleLocked: boolean;
  unlockIdleSession: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  isIdleLocked: false,
  unlockIdleSession: async () => false,
});

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdleLocked, setIsIdleLocked] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore stored session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('warehouse_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.user) {
          setUser(parsed.user);
        }
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsIdleLocked(false);
    localStorage.removeItem('warehouse_session');
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!user) return;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsIdleLocked(true);
    }, IDLE_TIMEOUT_MS);
  }, [user]);

  // Listen for user activity to reset idle timer
  useEffect(() => {
    if (!user || isIdleLocked) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();

    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, isIdleLocked, resetIdleTimer]);

  const login = (userData: User) => {
    setUser(userData);
    setIsIdleLocked(false);
    localStorage.setItem('warehouse_session', JSON.stringify({ user: userData, loginTime: Date.now() }));
    resetIdleTimer();
  };

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      localStorage.setItem('warehouse_session', JSON.stringify({ user: updated, loginTime: Date.now() }));
      return updated;
    });
  };

  const unlockIdleSession = async (password: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: user.user_code, password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsIdleLocked(false);
        resetIdleTimer();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        isIdleLocked,
        unlockIdleSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
