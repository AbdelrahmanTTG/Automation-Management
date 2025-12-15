"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axiosClient from "../../app/AxiosClint";

interface PermissionContextType {
  menuItems: any[] | null;
  setUser: (user: any) => void;
  user: any;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user?.role) return;

    const fetchPermissions = async () => {
      try {
        const res = await axiosClient.post("api/permission", { role: user.role });
        const Items = Object.values(res.data);
        setMenuItems([{ Items }]);
      } catch (error: any) {
        console.error(error);
        alert(error.response?.data?.message || "Request failed");
      }
    };

    fetchPermissions();
  }, [user]);

  return (
    <PermissionContext.Provider value={{ menuItems, setUser, user }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) throw new Error("usePermissions must be used within a PermissionProvider");
  return context;
};
