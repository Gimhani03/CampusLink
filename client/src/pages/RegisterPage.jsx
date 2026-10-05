import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, Mail, Hash, BookOpen, Calendar, Phone,
  UserPlus, AlertCircle, ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { INTERESTS } from "../constants/interests";
import { isNsbmStudentEmail, NSBM_STUDENT_EMAIL_DOMAIN, NSBM_STUDENT_EMAIL_SUFFIX } from "../constants/nsbm";
import AuthShell, { AuthField } from "../components/auth/AuthShell";
import { PasswordInput, TextInput } from "../components/auth/auth-inputs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const InterestSelector = ({ selected, onChange }) => {
  const groups = [...new Set(INTERESTS.map((i) => i.group))];
  return (
    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
      {groups.map((group) => (
        <div key={group}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-muted-foreground">
            {group}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {INTERESTS.filter((i) => i.group === group).map(({ value, label, emoji }) => {
              const active = selected.includes(value);
              return (
                <Badge
                  key={value}
                  variant={active ? "default" : "secondary"}
                  render={<button type="button" />}
                  onClick={() =>
                    onChange(active ? selected.filter((i) => i !== value) : [...selected, value])
                  }
                  className="cursor-pointer h-auto py-1 px-2.5 gap-1"
                >
                  <span>{emoji}</span> {label}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const STEPS = ["Personal Info", "Academic Info", "Password & Interests"];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const [form, setForm] = useState({
    fullName: "", email: "", whatsappNumber: "+94",
    studentId: "", degree: "", batch: "",
    password: "", confirmPassword: "", interests: [],
  });

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.fullName.trim()) e.fullName = "Full name is required.";
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
        e.email = "Valid email required.";
      } else if (!isNsbmStudentEmail(form.email)) {
        e.email = `Use your NSBM student email (${NSBM_STUDENT_EMAIL_SUFFIX}).`;
      }
      if (!form.whatsappNumber.match(/^\+[1-9]\d{7,14}$/)) e.whatsappNumber = "Use international format, e.g. +94771234567.";
    }
    if (s === 1) {
      if (!form.studentId.trim()) e.studentId = "Student ID is required.";
      if (!form.degree.trim()) e.degree = "Degree programme is required.";
      if (!form.batch.trim() || !/^\d{4}(\/\d{4})?$/.test(form.batch)) e.batch = "Enter a year (2021) or academic year (2021/2022).";
    }
    if (s === 2) {
      if (form.password.length < 8) e.password = "Minimum 8 characters.";
      else if (!/[A-Z]/.test(form.password)) e.password = "Must include an uppercase letter.";
      else if (!/[a-z]/.test(form.password)) e.password = "Must include a lowercase letter.";
      else if (!/\d/.test(form.password)) e.password = "Must include a number.";
      else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(form.password)) e.password = "Must include a special character.";
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
    const e2 = validateStep(2);
    setErrors(e2);
    if (Object.keys(e2).length) return;

    setLoading(true);
    setApiError("");
    try {
      const user = await register({
        fullName: form.fullName,
        email: form.email,
        whatsappNumber: form.whatsappNumber,
        studentId: form.studentId,
        degree: form.degree,
        batch: form.batch,
        password: form.password,
        confirmPassword: form.confirmPassword,
        interests: form.interests,
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
      variant="register"
      title="Create your account"
      subtitle="NSBM Green University students only — three quick steps"
      step={{ current: step, total: STEPS.length, labels: STEPS }}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
          {" · "}
          From another university?{" "}
          <Link to="/register/guest" className="font-semibold text-primary hover:underline">
            Guest signup
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
              <AuthField
                label="NSBM Student Email"
                error={errors.email}
                htmlFor="email"
                hint={`Must be your official @${NSBM_STUDENT_EMAIL_DOMAIN} address.`}
              >
                <TextInput id="email" icon={Mail} type="email" placeholder="you@students.nsbm.ac.lk"
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
              <AuthField label="Student ID" error={errors.studentId} htmlFor="studentId">
                <TextInput id="studentId" icon={Hash} placeholder="e.g. STD/2022/CS/001"
                  value={form.studentId} onChange={set("studentId")} />
              </AuthField>
              <AuthField label="Degree Programme" error={errors.degree} htmlFor="degree">
                <TextInput id="degree" icon={BookOpen} placeholder="e.g. BSc Computer Science"
                  value={form.degree} onChange={set("degree")} />
              </AuthField>
              <AuthField label="Batch / Intake Year" error={errors.batch} htmlFor="batch">
                <TextInput id="batch" icon={Calendar} placeholder="e.g. 2022 or 2022/2023"
                  value={form.batch} onChange={set("batch")} />
              </AuthField>
            </>
          )}

          {step === 2 && (
            <>
              <AuthField label="Password" error={errors.password}>
                <PasswordInput placeholder="Min. 8 chars with A-Z, 0-9, symbol"
                  value={form.password} onChange={set("password")} autoComplete="new-password" />
              </AuthField>
              <AuthField label="Confirm Password" error={errors.confirmPassword}>
                <PasswordInput placeholder="Repeat your password"
                  value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
              </AuthField>
              <AuthField label="Interests (optional)" hint="Helps us recommend events you'll enjoy">
                <InterestSelector
                  selected={form.interests}
                  onChange={(v) => setForm((p) => ({ ...p, interests: v }))}
                />
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
                  Create Account
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
