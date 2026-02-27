import React, { createContext, useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase/db";

export const AuthContext = createContext(null);

const STORAGE_KEY = "karma_user_session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch (error) {
      console.error("restore session error", error);
    } finally {
      setBootLoading(false);
    }
  }, []);

  const login = async (phone) => {
  const cleanPhone = String(phone || "").trim();

  if (!cleanPhone) {
    throw new Error("من فضلك أدخل رقم الهاتف");
  }

  const snapshot = await get(ref(db, "users"));
  const data = snapshot.val() || {};

  const users = Object.entries(data).map(([id, value]) => ({
    id,
    ...value,
  }));

  const foundUser = users.find(
    (item) =>
      String(item.phone || "").trim() === cleanPhone &&
      item.isActive !== false
  );

  if (!foundUser) {
    throw new Error("رقم الهاتف غير موجود أو الحساب غير مفعل");
  }

  const userWithRole = {
    ...foundUser,
    role: foundUser.role || "cashier",
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(userWithRole));
  setUser(userWithRole);

  return userWithRole;
};

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo(() => {
    return {
      user,
      bootLoading,
      login,
      logout,
    };
  }, [user, bootLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}