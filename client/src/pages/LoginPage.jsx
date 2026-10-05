import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, LogIn, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AuthField } from "../components/auth/AuthShell";
import { PasswordInput, TextInput } from "../components/auth/auth-inputs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="student"
      title="Welcome back"
      subtitle="Sign in to discover and register for campus events"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </>
      }
      bottomNote={
        <>
          Not from NSBM?{" "}
          <Link to="/register/guest" className="font-semibold text-primary hover:underline">
            Guest signup for hackathons
          </Link>
          {" · "}
          <Link to="/admin/login" className="text-muted-foreground hover:text-foreground">
            Admin login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="University Email" htmlFor="email">
          <TextInput
            id="email"
            icon={Mail}
            type="email"
            placeholder="you@students.nsbm.ac.lk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </AuthField>

        <AuthField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
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
              <LogIn className="size-4" />
              Sign In
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
