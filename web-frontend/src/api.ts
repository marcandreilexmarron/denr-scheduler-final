
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || "";
};

export const api = {
  get: async (path: string) => {
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(errorData.message || "Api error", response.status);
    }
    return response.json();
  },
  post: async (path: string, body: any) => {
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(errorData.message || "Api error", response.status);
    }
    return response.json();
  },
  put: async (path: string, body: any) => {
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(errorData.message || "Api error", response.status);
    }
    return response.json();
  },
  delete: async (path: string) => {
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(errorData.message || "Api error", response.status);
    }
    return response.json();
  },
};
