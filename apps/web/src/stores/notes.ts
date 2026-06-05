import { defineStore } from "pinia";
import type { Note, NoteListItem } from "@notewell/types";
import { api } from "../api/client";

interface State {
  list: NoteListItem[];
  current: Note | null;
  canEdit: boolean;
}

export const useNotesStore = defineStore("notes", {
  state: (): State => ({ list: [], current: null, canEdit: false }),
  actions: {
    async fetchList(q = "") {
      const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : "/api/notes";
      const { notes } = await api.get<{ notes: NoteListItem[] }>(url);
      this.list = notes;
    },
    async fetchOne(id: string) {
      const { note, canEdit } = await api.get<{ note: Note; canEdit: boolean }>(
        `/api/notes/${id}`,
      );
      this.current = note;
      this.canEdit = canEdit;
    },
    async create(title: string, body: string) {
      const { note } = await api.post<{ note: Note }>("/api/notes", { title, body });
      return note;
    },
    async update(id: string, title: string, body: string) {
      const { note } = await api.put<{ note: Note }>(`/api/notes/${id}`, { title, body });
      this.current = note;
      return note;
    },
    async remove(id: string) {
      await api.delete(`/api/notes/${id}`);
      this.list = this.list.filter((n) => n.id !== id);
      if (this.current?.id === id) this.current = null;
    },
    async share(id: string, username: string) {
      await api.post(`/api/notes/${id}/shares`, { username });
      await this.fetchOne(id);
    },
    async unshare(id: string, userId: string) {
      await api.delete(`/api/notes/${id}/shares/${userId}`);
      await this.fetchOne(id);
    },
    async uploadAttachment(id: string, file: File) {
      await api.upload(`/api/notes/${id}/attachment`, file);
      await this.fetchOne(id);
    },
  },
});
