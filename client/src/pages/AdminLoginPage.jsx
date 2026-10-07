/**
 * AdminLoginPage — Administrator sign-in (same AuthShell layout as student login).
 */

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AuthField } from "../components/auth/AuthShell";
import { PasswordInput, TextInput } from "../components/auth/auth-inputs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ADMIN_EMAIL, ADMIN_PASSWORD_DEV } from "@/constants/branding";

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/admin";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your admin email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== "admin") {
        setError("This portal is for administrators only.");
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="admin"
      eyebrow="Admin Portal"
      title="Administrator sign in"
      subtitle="Authorised staff only — manage events, registrations, and check-ins"
      footer={
        <>
          Are you a student?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Student login
          </Link>
        </>
      }
      bottomNote="University administration · Secure access"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {import.meta.env.DEV && (
          <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/60 px-3 py-2 font-mono leading-relaxed">
            Dev: {ADMIN_EMAIL} / {ADMIN_PASSWORD_DEV}
          </p>
        )}

        <AuthField label="Admin email" htmlFor="admin-email">
          <TextInput
            id="admin-email"
            icon={Mail}
            type="email"
            placeholder={ADMIN_EMAIL}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </AuthField>

        <AuthField label="Password" htmlFor="admin-password">
          <PasswordInput
            id="admin-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </AuthField>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        <Button type="submit" variant="gradient" disabled={loading} className="w-full h-11 mt-1">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Access dashboard
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
