/**
 * Blocks guest / external-university students from NSBM-only pages (channels, etc.).
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isExternalStudent } from "../../constants/eventAudience";

export default function CampusOnlyRoute({ children }) {
  const { user } = useAuth();
  if (isExternalStudent(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
