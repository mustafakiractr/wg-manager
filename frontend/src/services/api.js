/**
 * Axios API client (DÜZELTİLMİŞ)
 * - API her zaman same-origin: /api/v1
 * - Böylece HTTPS sayfada http://IP:8001 gibi çağrılar yapılmaz (Network Error biter)
 */
import axios from "axios";
import useAuthStore from "../store/authStore";

const isDev = import.meta.env.DEV;

// ✅ En güvenli ve stabil: her zaman same-origin
// Production örneği: https://yourdomain.com/api/v1/*
// Local dev'de: http://localhost:5173/api/v1/*  (Vite proxy ile backend'e gider)
const API_BASE_URL = "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
  // Eğer refresh token'ı httpOnly cookie ile tutuyorsan bunu açık bırakmak faydalı.
  // Same-origin olduğu için genelde sorun çıkarmaz.
  withCredentials: true,
});

// Debug log
if (isDev) {
  console.log("API Base URL:", API_BASE_URL);
  console.log("ENV:", {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  });
}

// Request interceptor - token ekle
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (isDev) {
      const fullURL = `${config.baseURL || ""}${config.url || ""}`;
      console.log("API Request:", {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL,
        fullURL,
        hasToken: !!accessToken,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    if (isDev) console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor - 401 olursa token yenile ve isteği tekrarla
api.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.log("API Response:", {
        status: response.status,
        url: response.config?.url,
      });
    }
    return response;
  },
  async (error) => {
    // Axios "Network Error" durumlarında error.response genelde yoktur.
    if (isDev) {
      console.error("API Error:", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
        fullURL: error?.config ? `${error.config.baseURL || ""}${error.config.url || ""}` : "unknown",
        responseURL: error?.request?.responseURL,
      });
    }

    const originalRequest = error.config;

    // 401 + retry yapılmadıysa: refresh dene
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshed = await useAuthStore.getState().refreshAccessToken();

        if (refreshed) {
          const { accessToken } = useAuthStore.getState();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } else {
          // Refresh başarısız - logout ve login sayfasına yönlendir
          console.warn("Token refresh failed - logging out");
          useAuthStore.getState().logout();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      } catch (refreshErr) {
        if (isDev) console.error("Token refresh error:", refreshErr);
        // Refresh hatası - logout ve login sayfasına yönlendir
        console.warn("Token refresh exception - logging out");
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
