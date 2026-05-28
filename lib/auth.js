"use client";

// Auth backed by Supabase users table. Custom login (not Supabase Auth)
// because we use username/password (no email). Passwords are stored
// plain-text in this prototype — fine for internal/demo use only.

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const SESSION_KEY = "marketing-dashboard-session";

export const ROLES = ["admin", "agent", "viewer"];

const PERMISSIONS = {
  admin:  { editData: true,  changeSettings: true,  manageUsers: true,  deleteUsers: true  },
  agent:  { editData: true,  changeSettings: true,  manageUsers: true,  deleteUsers: false },
  viewer: { editData: false, changeSettings: false, manageUsers: false, deleteUsers: false },
};

export function can(user, perm) {
  if (!user) return false;
  return !!PERMISSIONS[user.role]?.[perm];
}

const AuthContext = createContext({
  users: [],
  currentUser: null,
  hydrated: false,
  login: async () => false,
  logout: () => {},
  addUser: async () => ({}),
  updateUser: async () => ({}),
  deleteUser: async () => ({}),
});

function rowToUser(r) {
  return {
    id: r.id,
    username: r.username,
    password: r.password,
    name: r.name,
    role: r.role,
  };
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("inserted_at", { ascending: true });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Could not fetch users:", error.message);
      return [];
    }
    return (data || []).map(rowToUser);
  };

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const us = await fetchUsers();
      if (!mounted) return;
      setUsers(us);
      try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) setCurrentUserId(JSON.parse(raw));
      } catch {}
      setHydrated(true);
    })();
    return () => { mounted = false; };
  }, []);

  const persistSession = (id) => {
    setCurrentUserId(id);
    try {
      if (id) window.localStorage.setItem(SESSION_KEY, JSON.stringify(id));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  // ─── Mutations ───────────────────────────────
  const login = async (username, password) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();
    if (error || !data) return false;
    setUsers((prev) => {
      // make sure this user is in local cache
      if (prev.some((u) => u.id === data.id)) return prev;
      return [...prev, rowToUser(data)];
    });
    persistSession(data.id);
    return true;
  };

  const logout = () => persistSession(null);

  const addUser = async (data) => {
    const username = (data?.username || "").trim();
    if (!username) return { error: "usernameRequired" };
    if (!(data?.password || "").trim()) return { error: "passwordRequired" };
    if (users.some((u) => u.username === username)) return { error: "usernameTaken" };

    const id = "u" + Math.random().toString(36).slice(2, 8);
    const row = {
      id,
      username,
      password: data.password,
      name: (data.name || username).trim(),
      role: ROLES.includes(data.role) ? data.role : "viewer",
    };
    const { error } = await supabase.from("users").insert(row);
    if (error) {
      if (String(error.message || "").toLowerCase().includes("duplicate"))
        return { error: "usernameTaken" };
      return { error: error.message };
    }
    setUsers((prev) => [...prev, rowToUser(row)]);
    return { ok: true };
  };

  const updateUser = async (id, patch) => {
    const payload = {};
    let newUsername = null;
    if (patch.username !== undefined) {
      newUsername = String(patch.username).trim();
      if (newUsername && users.some((u) => u.id !== id && u.username === newUsername))
        return { error: "usernameTaken" };
      if (newUsername) payload.username = newUsername;
    }
    if (patch.name     !== undefined) payload.name = String(patch.name).trim();
    if (patch.role     !== undefined && ROLES.includes(patch.role)) payload.role = patch.role;
    if (patch.password !== undefined && patch.password) payload.password = patch.password;
    if (Object.keys(payload).length === 0) return { ok: true };

    const { error } = await supabase.from("users").update(payload).eq("id", id);
    if (error) return { error: error.message };
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...payload } : u)));
    return { ok: true };
  };

  const deleteUser = async (id) => {
    if (id === currentUserId) return { error: "cannotDeleteSelf" };
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return { error: error.message };
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return { ok: true };
  };

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  return (
    <AuthContext.Provider
      value={{ users, currentUser, hydrated, login, logout, addUser, updateUser, deleteUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
