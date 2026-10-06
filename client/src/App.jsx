/**
 * App.jsx — Root router
 *
 * Provider nesting (outer → inner):
 *   BrowserRouter (main.jsx)
 *     AuthProvider          ← token store + user state + auto-refresh
 *       Routes
 *         /login            ← public
 *         /register         ← public
 *         student paths     ← ProtectedRoute(student) → AppProvider → page
 *         /admin            ← ProtectedRoute(admin)   → AdminProvider → AdminDashboard
 *         *                 ← redirect to /login
 */

import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider }    from "./context/AuthContext";
import { AppProvider }     from "./context/AppContext";
import { AdminProvider }   from "./context/AdminContext";
import ProtectedRoute      from "./components/common/ProtectedRoute";
import CampusOnlyRoute     from "./components/common/CampusOnlyRoute";
import Dashboard               from "./pages/Dashboard";
import EventsPage              from "./pages/EventsPage";
import EventDetailPage         from "./pages/EventDetailPage";
import MyRegistrationsPage     from "./pages/MyRegistrationsPage";
import ChannelsPage             from "./pages/ChannelsPage";
import CalendarPage             from "./pages/CalendarPage";
import ProfilePage              from "./pages/ProfilePage";
import NotificationsPage        from "./pages/NotificationsPage";
import SavedEventsPage          from "./pages/SavedEventsPage";
import AdminDashboard          from "./pages/AdminDashboard";
import LoginPage               from "./pages/LoginPage";
import RegisterPage            from "./pages/RegisterPage";
import GuestRegisterPage       from "./pages/GuestRegisterPage";
import AdminLoginPage          from "./pages/AdminLoginPage";
import PassPage                from "./pages/PassPage";

/** Shared layout — one AppProvider for all student routes (preserves state across navigation). */
const StudentLayout = () => (
  <ProtectedRoute requiredRole="student">
    <AppProvider>
      <Outlet />
    </AppProvider>
  </ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public ──────────────────────────────────────────────────── */}
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"       element={<RegisterPage />} />
        <Route path="/register/guest" element={<GuestRegisterPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/pass/:token"  element={<PassPage />} />

        {/* ── Student (role: student) ──────────────────────────────────── */}
        <Route element={<StudentLayout />}>
          <Route path="/events"          element={<EventsPage />} />
          <Route path="/events/:id"      element={<EventDetailPage />} />
          <Route path="/channels" element={<CampusOnlyRoute><ChannelsPage /></CampusOnlyRoute>} />
          <Route path="/profile"          element={<ProfilePage />} />
          <Route path="/calendar"         element={<CalendarPage />} />
          <Route path="/my-events"        element={<MyRegistrationsPage />} />
          <Route path="/notifications"    element={<NotificationsPage />} />
          <Route path="/saved"            element={<SavedEventsPage />} />
          <Route path="/"                 element={<Dashboard />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/community"        element={<Dashboard />} />
          <Route path="/settings"        element={<Dashboard />} />
        </Route>

        {/* ── Admin (role: admin) ──────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProvider>
                <AdminDashboard />
              </AdminProvider>
            </ProtectedRoute>
          }
        />

        {/* ── Catch-all ────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
