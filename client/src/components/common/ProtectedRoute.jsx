/**
 * ProtectedRoute
 *
 * Renders children only if the user is authenticated.
 * Redirects unauthenticated visitors to /login.
 *
 * Optional `requiredRole` prop restricts access to a specific role
 * (e.g. "admin"). If the user's role doesn't match they are sent
 * to the appropriate dashboard instead of an error page.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, isLoading } = useAuth();
  const location            = useLocation();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    // Admin-only routes redirect to the admin portal; all others to /login.
    const adminLogin = requiredRole === "admin" ? "/admin/login" : "/login";
    return <Navigate to={adminLogin} state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Wrong role: send to their own dashboard.
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}
