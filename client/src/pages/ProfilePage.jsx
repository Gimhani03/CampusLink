/**
 * ProfilePage — View and edit the student's own profile.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, BookOpen, Hash, CalendarDays,
  Camera, Save, Lock, Eye, EyeOff, Check, X,
  Shield, Loader2, AlertCircle, CheckCircle2, Sparkles,
} from "lucide-react";
import { format } from "date-fns";

import Navbar      from "../components/layout/Navbar";
import Sidebar     from "../components/layout/Sidebar";
import SearchModal from "../components/dashboard/SearchModal";
import { useAuth } from "../context/AuthContext";
import { useApp }  from "../context/AppContext";
import * as authService from "../services/auth.service";
import { INTERESTS } from "../constants/interests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const StatusAlert = ({ type = "success", message }) => (
  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <Alert variant={type === "error" ? "destructive" : "default"} className={type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
      {type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  </motion.div>
);

const PasswordInput = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-10 bg-input/30"
        />
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
      </div>
    </div>
  );
};

const FormInput = ({ label, value, onChange, placeholder, icon: Icon, readOnly = false, type = "text" }) => (
  <div className="space-y-2">
    <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn(Icon && "pl-9", readOnly && "bg-slate-50 border-slate-200 text-foreground cursor-default")}
      />
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, icon: Icon, iconClassName = "bg-primary/10 text-primary border-primary/20", children }) => (
  <Card className="gap-0 overflow-hidden py-0">
    <CardHeader className="border-b border-border/60 px-6 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className={cn("size-7 rounded-xl flex items-center justify-center border", iconClassName)}>
          <Icon size={14} />
        </div>
        <div>
          <CardTitle className="font-display text-sm">{title}</CardTitle>
          {subtitle && <CardDescription className="text-xs mt-0.5">{subtitle}</CardDescription>}
        </div>
      </div>
    </CardHeader>
    <CardContent className="px-6 pt-5 pb-6">{children}</CardContent>
  </Card>
);

const AvatarUpload = ({ user, onUpdate, onRefresh }) => {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    handleUpload(file);
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setAlert(null);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const updated = await authService.updateAvatar(fd);
      onUpdate(updated);
      setPreview(null);
      onRefresh();
      setAlert({ type: "success", message: "Profile picture updated!" });
    } catch (e) {
      setAlert({ type: "error", message: e.response?.data?.message || "Upload failed." });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const src = preview
    || user?.profilePicture?.url
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.fullName ?? "Student")}&backgroundColor=0d6b4a&fontColor=ffffff`;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="size-20 rounded-2xl overflow-hidden border-2 border-primary/20 ring-2 ring-primary/5">
          <img src={src} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        {loading && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-background/70">
            <Loader2 size={18} className="animate-spin text-primary" />
          </div>
        )}
        <Button
          type="button"
          size="icon-xs"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="absolute -bottom-2 -right-2 size-7 rounded-xl bg-primary border-2 border-card"
        >
          <Camera size={12} className="text-white" />
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-display font-black text-xl truncate text-foreground">{user?.fullName}</h2>
        <p className="text-sm mt-0.5 truncate text-muted-foreground">{user?.email}</p>
        <Badge variant="outline" className="mt-1.5 capitalize bg-emerald-50 text-emerald-800 border-emerald-200">{user?.role}</Badge>
        <AnimatePresence>
          {alert && <div className="mt-2"><StatusAlert {...alert} /></div>}
        </AnimatePresence>
      </div>
    </div>
  );
};

const PROFILE_STATS = [
  { key: "totalRegistrations",  label: "Registrations",     chipClass: "bg-emerald-50 border-emerald-200", valueClass: "text-emerald-800" },
  { key: "upcomingRegistrations", label: "Upcoming",        chipClass: "bg-sky-50 border-sky-200",         valueClass: "text-sky-800"     },
  { key: "followedChannels",    label: "Followed Channels", chipClass: "bg-primary/5 border-primary/20",   valueClass: "text-primary"     },
  { key: "savedEvents",         label: "Saved Events",      chipClass: "bg-slate-50 border-slate-200",     valueClass: "text-foreground"  },
];

export default function ProfilePage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { student } = useApp();

  const [info, setInfo] = useState({
    fullName: user?.fullName ?? "",
    degree: user?.degree ?? "",
    batch: user?.batch ?? "",
    whatsappNumber: user?.whatsappNumber ?? "",
  });
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoAlert, setInfoAlert] = useState(null);

  const [interests, setInterests] = useState(new Set(user?.interests ?? []));
  const [intLoading, setIntLoading] = useState(false);
  const [intAlert, setIntAlert] = useState(null);

  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdAlert, setPwdAlert] = useState(null);

  useEffect(() => {
    if (!user) return;
    setInfo({ fullName: user.fullName, degree: user.degree, batch: user.batch, whatsappNumber: user.whatsappNumber });
    setInterests(new Set(user.interests ?? []));
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveInfo = async (e) => {
    e.preventDefault();
    setInfoLoading(true);
    setInfoAlert(null);
    try {
      const updated = await authService.updateProfile(info);
      updateUser(updated);
      setInfoAlert({ type: "success", message: "Profile updated successfully." });
      refreshUser();
    } catch (err) {
      setInfoAlert({ type: "error", message: err.response?.data?.message || "Update failed." });
    } finally {
      setInfoLoading(false);
    }
  };

  const saveInterests = async () => {
    setIntLoading(true);
    setIntAlert(null);
    try {
      const updated = await authService.updateProfile({ interests: [...interests] });
      updateUser(updated);
      setIntAlert({ type: "success", message: "Interests saved." });
      refreshUser();
    } catch (err) {
      setIntAlert({ type: "error", message: err.response?.data?.message || "Update failed." });
    } finally {
      setIntLoading(false);
    }
  };

  const toggleInterest = (val) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else if (next.size < 20) next.add(val);
      return next;
    });
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdAlert(null);
    try {
      await authService.changePassword(pwd);
      setPwd({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setPwdAlert({ type: "success", message: "Password changed successfully." });
    } catch (err) {
      setPwdAlert({ type: "error", message: err.response?.data?.message || "Failed to change password." });
    } finally {
      setPwdLoading(false);
    }
  };

  const stats = student?.stats;

  return (
    <div className="min-h-dvh mesh-bg">
      <SearchModal />
      <Navbar />

      <div className="flex max-w-screen-2xl mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="px-4 sm:px-8 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                <User size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl text-foreground">My Profile</h1>
                <p className="text-xs mt-0.5 text-muted-foreground">Manage your personal information and preferences</p>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-8 pt-6 pb-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-1 space-y-5">
                <Card className="gap-0 py-0">
                  <CardContent className="p-6">
                    <AvatarUpload user={user} onUpdate={updateUser} onRefresh={refreshUser} />
                  </CardContent>
                </Card>

                {stats && (
                  <div className="grid grid-cols-2 gap-3">
                    {PROFILE_STATS.map(({ key, label, chipClass, valueClass }) => (
                      <div
                        key={key}
                        className={cn("rounded-xl border px-4 py-3", chipClass)}
                      >
                        <p className={cn("font-display font-bold text-2xl tabular-nums leading-none", valueClass)}>
                          {stats[key] ?? 0}
                        </p>
                        <p className="text-[11px] mt-1.5 leading-tight text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <SectionCard
                  title="Account Info"
                  subtitle={user?.studentType === "external" ? "Account details, read-only" : "University-issued, read-only"}
                  icon={Shield}
                  iconClassName="bg-sky-50 text-sky-800 border-sky-200"
                >
                  <div className="space-y-3">
                    <FormInput
                      label={user?.studentType === "external" ? "Personal Email" : "University Email"}
                      value={user?.email ?? ""}
                      icon={Mail}
                      readOnly
                    />
                    {user?.studentType !== "external" && (
                      <FormInput label="Student ID" value={user?.studentId ?? ""} icon={Hash} readOnly />
                    )}
                    <FormInput
                      label="Member Since"
                      value={user?.createdAt ? format(new Date(user.createdAt), "d MMMM yyyy") : ""}
                      icon={CalendarDays}
                      readOnly
                    />
                  </div>
                </SectionCard>
              </div>

              <div className="xl:col-span-2 space-y-5">
                <SectionCard title="Personal Information" subtitle="Update your profile details" icon={User}>
                  <form onSubmit={saveInfo} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput label="Full Name" value={info.fullName}
                        onChange={(v) => setInfo((p) => ({ ...p, fullName: v }))}
                        placeholder="Your full name" icon={User} />
                      <FormInput label="WhatsApp Number" value={info.whatsappNumber}
                        onChange={(v) => setInfo((p) => ({ ...p, whatsappNumber: v }))}
                        placeholder="+94771234567" icon={Phone} />
                    </div>
                    <FormInput label="Degree Programme" value={info.degree}
                      onChange={(v) => setInfo((p) => ({ ...p, degree: v }))}
                      placeholder="e.g. BSc (Hons) Computer Science" icon={BookOpen} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput label="Batch / Intake Year" value={info.batch}
                        onChange={(v) => setInfo((p) => ({ ...p, batch: v }))}
                        placeholder="e.g. 2022 or 2022/2023" icon={CalendarDays} />
                    </div>
                    <AnimatePresence>{infoAlert && <StatusAlert {...infoAlert} />}</AnimatePresence>
                    <div className="flex justify-end">
                      <Button type="submit" variant="gradient" disabled={infoLoading}>
                        {infoLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Interests" subtitle={`${interests.size} selected — drives event recommendations`} icon={Sparkles}>
                  <div className="space-y-4 mb-4">
                    {[...new Set(INTERESTS.map((i) => i.group))].map((group) => (
                      <div key={group}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-muted-foreground">{group}</p>
                        <div className="flex flex-wrap gap-2">
                          {INTERESTS.filter((i) => i.group === group).map(({ value, label, emoji }) => {
                            const active = interests.has(value);
                            return (
                              <Button
                                key={value}
                                type="button"
                                variant={active ? "default" : "outline"}
                                size="xs"
                                onClick={() => toggleInterest(value)}
                                className={cn("rounded-full gap-1.5", active && "bg-primary hover:bg-primary/90")}
                              >
                                <span>{emoji}</span> {label}
                                {active && <Check size={11} />}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <AnimatePresence>{intAlert && <StatusAlert {...intAlert} />}</AnimatePresence>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{interests.size} / {INTERESTS.length} selected</p>
                    <Button type="button" variant="gradient" onClick={saveInterests} disabled={intLoading}>
                      {intLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Save Interests
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Change Password"
                  subtitle="Use a strong password with uppercase, numbers & symbols"
                  icon={Lock}
                  iconClassName="bg-red-50 text-red-700 border-red-200"
                >
                  <form onSubmit={savePassword} className="space-y-4">
                    <PasswordInput label="Current Password" value={pwd.currentPassword}
                      onChange={(v) => setPwd((p) => ({ ...p, currentPassword: v }))}
                      placeholder="Enter current password" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PasswordInput label="New Password" value={pwd.newPassword}
                        onChange={(v) => setPwd((p) => ({ ...p, newPassword: v }))}
                        placeholder="Min 8 characters" />
                      <PasswordInput label="Confirm New Password" value={pwd.confirmNewPassword}
                        onChange={(v) => setPwd((p) => ({ ...p, confirmNewPassword: v }))}
                        placeholder="Repeat new password" />
                    </div>

                    {pwd.newPassword && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { test: pwd.newPassword.length >= 8, label: "8+ characters" },
                          { test: /[A-Z]/.test(pwd.newPassword), label: "Uppercase letter" },
                          { test: /[a-z]/.test(pwd.newPassword), label: "Lowercase letter" },
                          { test: /\d/.test(pwd.newPassword), label: "Number" },
                          { test: /[!@#$%^&*]/.test(pwd.newPassword), label: "Special character" },
                          { test: pwd.newPassword === pwd.confirmNewPassword && pwd.confirmNewPassword.length > 0, label: "Passwords match" },
                        ].map(({ test, label }) => (
                          <div key={label} className={cn("flex items-center gap-1.5 text-xs", test ? "text-emerald-700" : "text-muted-foreground")}>
                            {test ? <Check size={11} /> : <X size={11} />} {label}
                          </div>
                        ))}
                      </div>
                    )}

                    <AnimatePresence>{pwdAlert && <StatusAlert {...pwdAlert} />}</AnimatePresence>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="gradient"
                        disabled={pwdLoading || !pwd.currentPassword || !pwd.newPassword || !pwd.confirmNewPassword}
                        className="disabled:opacity-50"
                      >
                        {pwdLoading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                        Update Password
                      </Button>
                    </div>
                  </form>
                </SectionCard>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
