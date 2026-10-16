import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_HOME } from "../utils/roles";
import { FullScreenSpinner, PendingSetupPanel } from "../app/guards";

export default function RoleHome() {
  const { role, isLoading, session } = useAuth();

  if (isLoading) {
    return <FullScreenSpinner />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (role) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <PendingSetupPanel />;
}
