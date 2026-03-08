import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import toast from "react-hot-toast";

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  errors?: any[];
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data;

    if (!res.success) {
      toast.error(res.message || "Request failed");
      return Promise.reject(res);
    }

    return res.data;
  },
  (error) => {
    if (error.code === "ECONNABORTED") {
      toast.error(
        "Server starting, retry shortly"
      );
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

export default api;
