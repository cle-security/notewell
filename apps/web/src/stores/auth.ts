import { defineStore } from "pinia";
import type { SessionUser } from "@notewell/types";
import { api } from "../api/client";

interface State {
  user: SessionUser | null;
  ready: boolean;
}

export const useAuthStore = defineStore("auth", {
  state: (): State => ({ user: null, ready: false }),
  getters: {
    isAuthed: (s) => !!s.user,
    isAdmin: (s) => s.user?.role === "admin",
  },
  actions: {
    async fetchMe() {
      try {
        const { user } = await api.get<{ user: SessionUser | null }>("/api/auth/me");
        this.user = user;
      } catch {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },
    async login(email: string, password: string) {
      const { user } = await api.post<{ user: SessionUser }>("/api/auth/login", {
        email,
        password,
      });
      this.user = user;
    },
    async signup(input: {
      email: string;
      username: string;
      displayName: string;
      password: string;
    }) {
      const { user } = await api.post<{ user: SessionUser }>("/api/auth/signup", input);
      this.user = user;
    },
    async logout() {
      await api.post("/api/auth/logout");
      this.user = null;
    },
  },
});
