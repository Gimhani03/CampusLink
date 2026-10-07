/**
 * AdminProfile — View and edit the administrator's account.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  User, Mail, Phone, CalendarDays, Camera, Save, Lock, Eye, EyeOff,
  Check, X, Shield, Loader2, AlertCircle, CheckCircle2, LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useAdmin } from "../../context/AdminContext";
import * as authService from "../../services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const avatarUrl = (user, preview) =>
  preview
  || user?.profilePicture?.url
  || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.fullName ?? "Admin")}&backgroundColor=0d6b4a&fontColor=ffffff`;

const PROFILE_STATS = [
  { key: "totalEvents",        label: "Events managed",  chipClass: "bg-emerald-50 border-emerald-200", valueClass: "text-emerald-800" },
  { key: "totalRegistrations", label: "Registrations",   chipClass: "bg-sky-50 border-sky-200",         valueClass: "text-sky-800"     },
  { key: "publishedEvents",    label: "Published",       chipClass: "bg-slate-50 border-slate-200",     valueClass: "text-foreground"  },
  { key: "activeStudents",     label: "Active students", chipClass: "bg-primary/5 border-primary/20",   valueClass: "text-primary"     },
];

const statValue = (stat) => {
  const raw = stat?.value ?? stat ?? 0;
  return typeof raw === "number" ? raw.toLocaleString() : raw;
};

const StatusAlert = ({ type = "success", message }) => (
  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <Alert
      variant={type === "error" ? "destructive" : "default"}
      className={type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}
    >
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
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
      </div>
    </div>
  );
};

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
      setAlert({ type: "success", message: "Profile picture updated." });
    } catch (e) {
      setAlert({ type: "error", message: e.response?.data?.message || "Upload failed." });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    handleUpload(file);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="size-20 rounded-2xl overflow-hidden border-2 border-primary/20 ring-2 ring-primary/5">
          <img src={avatarUrl(user, preview)} alt="Admin avatar" className="w-full h-full object-cover" />
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
          className="absolute -bottom-2 -right-2 size-7 rounded-xl bg-primary hover:bg-primary/90 border-2 border-card"
        >
          <Camera size={12} className="text-white" />
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-display font-black text-xl truncate text-foreground">{user?.fullName}</h2>
        <p className="text-sm mt-0.5 truncate text-muted-foreground">{user?.email}</p>
        <Badge variant="outline" className="mt-1.5 bg-emerald-50 text-emerald-800 border-emerald-200">
          <Shield size={10} className="mr-1" /> Administrator
        </Badge>
        <AnimatePresence>
          {alert && <div className="mt-2"><StatusAlert {...alert} /></div>}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function AdminProfile() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const { stats } = useAdmin();
  const navigate = useNavigate();

  const [info, setInfo] = useState({
    fullName: user?.fullName ?? "",
    whatsappNumber: user?.whatsappNumber ?? "",
  });
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoAlert, setInfoAlert] = useState(null);

  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdAlert, setPwdAlert] = useState(null);

  useEffect(() => {
    if (!user) return;
    setInfo({ fullName: user.fullName ?? "", whatsappNumber: user.whatsappNumber ?? "" });
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

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
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
                  {statValue(stats[key])}
                </p>
                <p className="text-[11px] mt-1.5 leading-tight text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        <SectionCard
          title="Account Info"
          subtitle="Read-only credentials"
          icon={Shield}
          iconClassName="bg-sky-50 text-sky-800 border-sky-200"
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Admin email</Label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={user?.email ?? ""} readOnly className="pl-9 bg-slate-50 border-slate-200 text-foreground cursor-default" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Role</Label>
              <div className="relative">
                <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value="Administrator" readOnly className="pl-9 bg-slate-50 border-slate-200 text-foreground cursor-default" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Member since</Label>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={user?.createdAt ? format(new Date(user.createdAt), "d MMMM yyyy") : ""}
                  readOnly
                  className="pl-9 bg-slate-50 border-slate-200 text-foreground cursor-default"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full gap-2 text-red-800 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-900"
        >
          <LogOut size={15} /> Sign out
        </Button>
      </div>

      <div className="xl:col-span-2 space-y-5">
        <SectionCard title="Personal Information" subtitle="Update your display name and contact number" icon={User}>
          <form onSubmit={saveInfo} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Full name</Label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={info.fullName}
                    onChange={(e) => setInfo((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Your full name"
                    className="pl-9 bg-input/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">WhatsApp number</Label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={info.whatsappNumber}
                    onChange={(e) => setInfo((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="+94771234567"
                    className="pl-9 bg-input/30"
                  />
                </div>
              </div>
            </div>
            <AnimatePresence>{infoAlert && <StatusAlert {...infoAlert} />}</AnimatePresence>
            <div className="flex justify-end">
              <Button type="submit" disabled={infoLoading} className="gap-2 bg-primary hover:bg-primary/90 text-white">
                {infoLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Changes
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Change Password"
          subtitle="Use a strong password with uppercase, numbers and symbols"
          icon={Lock}
          iconClassName="bg-red-50 text-red-700 border-red-200"
        >
          <form onSubmit={savePassword} className="space-y-4">
            <PasswordInput
              label="Current password"
              value={pwd.currentPassword}
              onChange={(v) => setPwd((p) => ({ ...p, currentPassword: v }))}
              placeholder="Enter current password"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordInput
                label="New password"
                value={pwd.newPassword}
                onChange={(v) => setPwd((p) => ({ ...p, newPassword: v }))}
                placeholder="Min 8 characters"
              />
              <PasswordInput
                label="Confirm new password"
                value={pwd.confirmNewPassword}
                onChange={(v) => setPwd((p) => ({ ...p, confirmNewPassword: v }))}
                placeholder="Repeat new password"
              />
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
                disabled={pwdLoading || !pwd.currentPassword || !pwd.newPassword || !pwd.confirmNewPassword}
                className="gap-2 bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
              >
                {pwdLoading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                Update Password
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
