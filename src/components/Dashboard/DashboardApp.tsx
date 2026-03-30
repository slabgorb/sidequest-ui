import { useDashboardSocket } from "./hooks/useDashboardSocket";
import { DashboardLayout } from "./DashboardLayout";

export function DashboardApp() {
  const state = useDashboardSocket();

  return <DashboardLayout state={state} />;
}
