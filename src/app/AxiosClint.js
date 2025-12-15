import axios from "axios";
import Cookies from "js-cookie";
import { encryptData, decryptData } from "../packages/utils/helper";

const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const axiosClient = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get("ACCESS_TOKEN");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data && !(config.data instanceof FormData)) {
      try {
        const encryptedData = encryptData(config.data);
        config.data = { data: encryptedData };
      } catch (error) {
        console.error("Request encryption error:", error);
        return Promise.reject(error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosClient.interceptors.response.use(
  (response) => {
    try {
      if (response.data && typeof response.data.data === "string") {
        const decryptedData = decryptData(response.data.data);
        response.data = decryptedData;
      }
    } catch (error) {
      console.error("Response decryption error:", error);
      return Promise.reject(error);
    }
    return response;
  },
  (error) => {
    const { response } = error;

    if (response && response.status === 401) {
      Cookies.remove("ACCESS_TOKEN");
      Cookies.remove("USER");

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
