import type { ApiError } from "@notewell/types";

export class ApiException extends Error {
  status: number;
  code: string;
  constructor(status: number, body: ApiError) {
    super(body.message);
    this.status = status;
    this.code = body.error;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {},
  };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiException(res.status, parsed ?? { error: "error", message: res.statusText });
  }
  return parsed as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),

  upload: async <T>(url: string, file: File): Promise<T> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(url, { method: "POST", body: fd, credentials: "same-origin" });
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new ApiException(res.status, parsed ?? { error: "error", message: res.statusText });
    }
    return parsed as T;
  },
};
