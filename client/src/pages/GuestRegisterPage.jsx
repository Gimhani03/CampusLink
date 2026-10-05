import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, UserPlus, AlertCircle,
  ChevronRight, ChevronLeft, GraduationCap, Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EXTERNAL_UNIVERSITIES } from "../constants/registrationQuestions";
import { isNsbmStudentEmail, NSBM_STUDENT_EMAIL_SUFFIX } from "../constants/nsbm";
import AuthShell, { AuthField } from "../components/auth/AuthShell";
import { PasswordInput, TextInput } from "../components/auth/auth-inputs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STEPS = ["Your details", "Create password"];

export default function GuestRegisterPage() {
  const { registerGuest } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    university: "",
    email: "",
    whatsappNumber: "+94",
    password: "",
    confirmPassword: "",
  });

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.fullName.trim()) e.fullName = "Full name is required.";
      if (!form.university) e.university = "University is required.";
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
        e.email = "Valid personal email required.";
      } else if (isNsbmStudentEmail(form.email)) {
        e.email = `NSBM students must use ${NSBM_STUDENT_EMAIL_SUFFIX} on the main signup.`;
      }
      if (!form.whatsappNumber.match(/^\+[1-9]\d{7,14}$/)) {
        e.whatsappNumber = "Use international format, e.g. +94771234567.";
      }
    }
    if (s === 1) {
      if (form.password.length < 8) e.password = "Minimum 8 characters.";
      else if (!/[A-Z]/.test(form.password)) e.password = "Must include an uppercase letter.";
      else if (!/[a-z]/.test(form.password)) e.password = "Must include a lowercase letter.";
      else if (!/\d/.test(form.password)) e.password = "Must include a number.";
      else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(form.password)) {
        e.password = "Must include a special character.";
      }
      if (form.confirmPassword !== form.password) e.confirmPassword = "Passwords do not match.";
    }
    return e;
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (!Object.keys(e).length) setStep((p) => p + 1);
  };

  const back = () => { setErrors({}); setStep((p) => p - 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const e2 = validateStep(1);
    setErrors(e2);
    if (Object.keys(e2).length) return;

    setLoading(true);
    setApiError("");
    try {
      const user = await registerGuest({
        fullName: form.fullName,
        university: form.university,
        email: form.email,
        whatsappNumber: form.whatsappNumber,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) setApiError(msg[0]);
      else setApiError(msg || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="guest"
      eyebrow="Guest Access"
      title="Guest registration"
      subtitle="For inter-university hackathon participants from partner universities"
      step={{ current: step, total: STEPS.length, labels: STEPS }}
      footer={
        <>
          NSBM student?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Sign up here
          </Link>
          {" · "}
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {step === 0 && (
            <>
              <AuthField label="Full Name" error={errors.fullName} htmlFor="fullName">
                <TextInput id="fullName" icon={User} placeholder="e.g. Kasun Perera"
                  value={form.fullName} onChange={set("fullName")} autoComplete="name" />
              </AuthField>
              <AuthField label="Your University" error={errors.university}>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
                  <Select
                    value={form.university}
                    onValueChange={(v) => setForm((p) => ({ ...p, university: v }))}
                  >
                    <SelectTrigger className="w-full h-11 pl-9 bg-background/80">
                      <SelectValue placeholder="Select university…" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTERNAL_UNIVERSITIES.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AuthField>
              <AuthField
                label="Personal Email"
                error={errors.email}
                htmlFor="email"
                hint="Used to sign in and to look up teammates during hackathon registration."
              >
                <TextInput id="email" icon={Mail} type="email" placeholder="you@gmail.com"
                  value={form.email} onChange={set("email")} autoComplete="email" />
              </AuthField>
              <AuthField label="WhatsApp Number" error={errors.whatsappNumber} htmlFor="whatsapp">
                <TextInput id="whatsapp" icon={Phone} placeholder="+94771234567"
                  value={form.whatsappNumber} onChange={set("whatsappNumber")} autoComplete="tel" />
              </AuthField>
            </>
          )}

          {step === 1 && (
            <>
              <AuthField label="Password" error={errors.password}>
                <PasswordInput placeholder="Min. 8 chars with A-Z, 0-9, symbol"
                  value={form.password} onChange={set("password")} autoComplete="new-password" />
              </AuthField>
              <AuthField label="Confirm Password" error={errors.confirmPassword}>
                <PasswordInput placeholder="Repeat your password"
                  value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
              </AuthField>
            </>
          )}
        </div>

        {apiError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={back} className="h-11 px-4 shrink-0">
              <ChevronLeft className="size-4" /> Back
            </Button>
          )}

          {step < STEPS.length - 1 ? (
            <Button type="button" variant="gradient" onClick={next} className="flex-1 h-11">
              Continue <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" variant="gradient" disabled={loading} className="flex-1 h-11">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Create Guest Account
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
