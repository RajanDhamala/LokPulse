import axios, { type AxiosRequestConfig } from "axios";
import toast from "react-hot-toast";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown[];
}

const client = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      toast.error("Server starting, retry shortly");
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error("Something went wrong");
    }

    return Promise.reject(error.response?.data || error);
  }
);

const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await client.get<ApiResponse<T>>(url, config);
    const result = response.data;

    if (!result.success) {
      toast.error(result.message || "Request failed");
      return Promise.reject(result);
    }

    return result.data;
  },
};

export default api;
