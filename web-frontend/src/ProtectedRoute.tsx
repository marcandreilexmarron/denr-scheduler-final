import React from "react";
import { Navigate } from "react-router-dom";
import { getUserFromToken } from "./auth";

export default function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const user = getUserFromToken();
  if (!user) return <Navigate to="/" replace />;
  if (role) {
    const hasRole = String(user.role || "").endsWith(role);
    if (!hasRole) return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
