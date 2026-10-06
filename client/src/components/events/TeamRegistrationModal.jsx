/**
 * TeamRegistrationModal — Hackathon / team event registration.
 *
 * One student registers an entire team. The registrant's position determines
 * which member slot is auto-filled from their profile (name + WhatsApp).
 */

import { useState, useEffect, useMemo } from "react";
import {
  Check, AlertCircle, Ticket, Loader2, Users, GraduationCap, Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  NSBM_UNIVERSITY,
  TEAM_UNIVERSITY_LABEL,
} from "../../constants/registrationQuestions";
import { lookupTeamMember, lookupTeamMemberByEmail } from "../../services/registration.service";
import {
  ROLE_LABELS,
  getRolesForSize,
  getAllowedTeamSizes,
  getDefaultTeamSize,
  getTeamSizeBounds,
  buildMembersState,
  emptyMember,
  isExternalStudent,
} from "../../constants/teamRegistration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const Field = ({ label, required, children, htmlFor }) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>
      {label}
      {required && <span className="text-destructive"> *</span>}
    </Label>
    {children}
  </div>
);

export default function TeamRegistrationModal({ event, onClose, onSuccess, register }) {
  const { user } = useAuth();
  const questions = event.registrationQuestions ?? [];

  const allowedSizes = useMemo(() => getAllowedTeamSizes(event), [event]);
  const defaultSize = useMemo(() => getDefaultTeamSize(event), [event]);
  const sizeBounds = useMemo(() => getTeamSizeBounds(event), [event]);

  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(defaultSize);
  const [registrantRole, setRegistrantRole] = useState("leader");
  const [members, setMembers] = useState(() => buildMembersState(defaultSize, "leader", user));
  const [answers, setAnswers] = useState(() =>
    questions.map((q) => ({ questionId: q._id, answer: q.questionType === "checkbox" ? [] : "" }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const roles = useMemo(() => getRolesForSize(teamSize), [teamSize]);
  const isExternal = isExternalStudent(user);
  const teamUniversity = user?.university || (isExternal ? "" : NSBM_UNIVERSITY);

  useEffect(() => {
    if (!allowedSizes.includes(teamSize)) {
      setTeamSize(defaultSize);
    }
  }, [allowedSizes, defaultSize, teamSize]);

  // Rebuild member slots when size or registrant role changes — preserve looked-up teammates.
  useEffect(() => {
    const available = getRolesForSize(teamSize);
    const role = available.includes(registrantRole) ? registrantRole : "leader";
    if (role !== registrantRole) setRegistrantRole(role);
    setMembers((prev) => buildMembersState(teamSize, role, user, prev));
  }, [teamSize, registrantRole, user]);

  useEffect(() => {
    setAnswers(questions.map((q) => ({ questionId: q._id, answer: q.questionType === "checkbox" ? [] : "" })));
  }, [event._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMember = (role, field, value) => {
    setMembers((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
        ...(field === "studentId" || field === "lookupEmail"
          ? { lookupStatus: "idle", lookupError: "" }
          : {}),
      },
    }));
  };

  const lookupMember = async (role) => {
    if (isExternal) {
      await lookupMemberByEmail(role);
      return;
    }

    const id = members[role]?.studentId?.trim();
    if (!id) {
      setMembers((prev) => ({
        ...prev,
        [role]: { ...prev[role], lookupError: "Enter a student ID first." },
      }));
      return;
    }

    if (user?.studentId && id.toUpperCase() === user.studentId.trim().toUpperCase()) {
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...emptyMember(),
          lookupError: "That's you — select your position above instead.",
        },
      }));
      return;
    }

    const duplicate = roles.some(
      (r) => r !== role && members[r]?.studentId?.trim().toUpperCase() === id.toUpperCase()
    );
    if (duplicate) {
      updateMember(role, "lookupError", "This student ID is already used on the team.");
      return;
    }

    setMembers((prev) => ({
      ...prev,
      [role]: { ...prev[role], lookupStatus: "loading", lookupError: "" },
    }));

    try {
      const profile = await lookupTeamMember(id, event._id);
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...prev[role],
          studentId: profile.studentId,
          fullName: profile.fullName,
          phone: profile.phone,
          personalEmail: profile.personalEmail ?? profile.universityEmail ?? "",
          universityEmail: profile.universityEmail ?? "",
          lookupStatus: "found",
          lookupError: "",
        },
      }));
    } catch (e) {
      const msg = e.response?.data?.message || "Lookup failed.";
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...emptyMember(),
          studentId: id.toUpperCase(),
          lookupStatus: "not_found",
          lookupError: msg.includes("No student") ? `No student found with ID "${id.toUpperCase()}". Enter their details manually.` : msg,
        },
      }));
    }
  };

  const lookupMemberByEmail = async (role) => {
    const email = members[role]?.lookupEmail?.trim().toLowerCase();
    if (!email) {
      setMembers((prev) => ({
        ...prev,
        [role]: { ...prev[role], lookupError: "Enter a registered email first." },
      }));
      return;
    }

    if (user?.email && email === user.email.trim().toLowerCase()) {
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...emptyMember(),
          lookupError: "That's you — select your position above instead.",
        },
      }));
      return;
    }

    const duplicate = roles.some((r) => {
      if (r === role) return false;
      const other = members[r]?.lookupEmail?.trim().toLowerCase()
        || members[r]?.personalEmail?.trim().toLowerCase();
      return other === email;
    });
    if (duplicate) {
      updateMember(role, "lookupError", "This email is already used on the team.");
      return;
    }

    setMembers((prev) => ({
      ...prev,
      [role]: { ...prev[role], lookupStatus: "loading", lookupError: "" },
    }));

    try {
      const profile = await lookupTeamMemberByEmail(email, event._id);
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...prev[role],
          lookupEmail: profile.lookupEmail ?? profile.personalEmail,
          personalEmail: profile.personalEmail,
          fullName: profile.fullName,
          phone: profile.phone,
          lookupStatus: "found",
          lookupError: "",
        },
      }));
    } catch (e) {
      const msg = e.response?.data?.message || "Lookup failed.";
      setMembers((prev) => ({
        ...prev,
        [role]: {
          ...emptyMember(),
          lookupEmail: email,
          lookupStatus: "not_found",
          lookupError: msg.includes("No registered")
            ? `No registered student found with "${email}". Enter their details manually.`
            : msg,
        },
      }));
    }
  };

  const enableManualEntry = (role) => {
    setMembers((prev) => ({
      ...prev,
      [role]: {
        ...emptyMember(),
        lookupStatus: "manual",
        lookupError: "",
      },
    }));
  };

  const enableStudentIdLookup = (role) => {
    setMembers((prev) => ({
      ...prev,
      [role]: emptyMember(),
    }));
  };

  const enableEmailLookup = (role) => {
    setMembers((prev) => ({
      ...prev,
      [role]: emptyMember(),
    }));
  };

  const updateAnswer = (i, value) => {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? { ...a, answer: value } : a)));
  };

  const toggleCheckbox = (i, option) => {
    setAnswers((prev) => prev.map((a, idx) => {
      if (idx !== i) return a;
      const arr = Array.isArray(a.answer) ? a.answer : [];
      return {
        ...a,
        answer: arr.includes(option) ? arr.filter((x) => x !== option) : [...arr, option],
      };
    }));
  };

  const memberContactEmail = (m) =>
    m?.personalEmail?.trim() || m?.universityEmail?.trim() || m?.lookupEmail?.trim() || "";

  const validate = () => {
    if (!teamName.trim()) return "Team name is required.";
    if (!teamUniversity) return "Your university must be set on your profile.";
    for (const role of roles) {
      const m = members[role];
      const label = ROLE_LABELS[role];
      const isYou = role === registrantRole;
      if (!isYou && m?.lookupStatus === "idle" && !m?.fullName?.trim()) {
        return isExternal
          ? `${label}: look up by registered email or enter details manually.`
          : `${label}: look up by student ID or enter details manually.`;
      }
      if (!m?.fullName?.trim()) return `${label}: full name is required.`;
      if (!m?.phone?.trim()) return `${label}: phone number is required.`;
      if (!memberContactEmail(m)) {
        return isExternal
          ? `${label}: personal email is required.`
          : `${label}: university or contact email is required.`;
      }
      if (!m?.nic?.trim()) return `${label}: NIC is required.`;
    }

    const ids = roles.map((r) => members[r]?.studentId?.trim().toUpperCase()).filter(Boolean);
    if (new Set(ids).size !== ids.length) return "Each team member must have a unique student ID.";
    const lookupEmails = roles.map((r) =>
      members[r]?.lookupEmail?.trim().toLowerCase() || members[r]?.personalEmail?.trim().toLowerCase()
    ).filter(Boolean);
    if (new Set(lookupEmails).size !== lookupEmails.length) {
      return "Each team member must have a unique email.";
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].isRequired) continue;
      const ans = answers[i]?.answer;
      if (!ans || (Array.isArray(ans) ? ans.length === 0 : String(ans).trim() === "")) {
        return `"${questions[i].question}" is required.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSubmitting(true);

    const teamPayload = {
      name: teamName.trim(),
      size: teamSize,
      university: teamUniversity,
      registrantRole,
      members: roles.map((role) => ({
        role,
        studentId: members[role].studentId?.trim() || undefined,
        fullName: members[role].fullName.trim(),
        phone: members[role].phone.trim(),
        personalEmail: memberContactEmail(members[role]),
        nic: members[role].nic.trim(),
        isRegistrant: role === registrantRole,
      })),
    };

    try {
      await register(event._id, answers, teamPayload);
      onSuccess();
    } catch (e) {
      const apiErrors = e.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        setError(apiErrors.map((x) => x.message).join(" "));
      } else {
        setError(e.response?.data?.message || "Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Users size={12} /> Team Registration
          </p>
          <DialogTitle className="font-display text-base leading-snug">
            {event.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Register your team for this event
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-6 px-5 py-4">
            <Alert className="border-primary/15 bg-primary/5">
              <AlertDescription className="text-xs">
                One team member registers the whole team. Your profile is auto-filled for the position you select.
                {isExternal ? (
                  <> Teammates must be from <strong>{teamUniversity}</strong>. Look them up by their <strong>registered email</strong>, or enter details manually for members not on the platform.</>
                ) : (
                  <> All teammates must be NSBM students. Look them up by <strong>student ID</strong> to pull their university email and contact details, or enter details manually if they are not on the platform.</>
                )}
                {" "}NIC is required for every member each event.
              </AlertDescription>
            </Alert>

            {/* Team basics */}
            <section className="space-y-4">
              <h4 className="text-sm font-bold text-foreground">Team details</h4>
              <Field label="Team name" required>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Code Crushers"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Team size" required>
                  {allowedSizes.length === 1 ? (
                    <Input value={`${allowedSizes[0]} members`} readOnly className="bg-muted/50" />
                  ) : (
                    <Select
                      value={String(teamSize)}
                      onValueChange={(v) => setTeamSize(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedSizes.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} members</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {sizeBounds.min === sizeBounds.max
                      ? `This event requires exactly ${sizeBounds.max} members per team.`
                      : `Choose ${sizeBounds.min}–${sizeBounds.max} members for your team.`}
                  </p>
                </Field>

                <Field label={TEAM_UNIVERSITY_LABEL} required>
                  <Input value={teamUniversity} readOnly />
                </Field>
              </div>

              <Field label="Your position in the team" required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {roles.map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={registrantRole === role ? "default" : "outline"}
                      onClick={() => setRegistrantRole(role)}
                      className="h-auto justify-start px-3 py-2.5 text-left text-xs font-semibold"
                    >
                      {registrantRole === role && <Check size={11} className="mr-1" />}
                      {ROLE_LABELS[role]}
                      {role === registrantRole && (
                        <span className="mt-0.5 block text-[10px] font-normal opacity-70">You</span>
                      )}
                    </Button>
                  ))}
                </div>
              </Field>
            </section>

            {/* Member sections */}
            <section className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <GraduationCap size={15} className="text-primary" />
                Team member details
              </h4>

              {roles.map((role) => {
                const isYou = role === registrantRole;
                const m = members[role] ?? {};
                const profileLinked = isYou || m.lookupStatus === "found";
                const showManualFields = isYou || m.lookupStatus === "found" || m.lookupStatus === "not_found" || m.lookupStatus === "manual";
                const showStudentIdLookup = !isYou && !isExternal && m.lookupStatus !== "manual";
                const showEmailLookup = !isYou && isExternal && m.lookupStatus !== "manual";
                const isLoading = m.lookupStatus === "loading";

                return (
                  <div
                    key={role}
                    className={cn(
                      "space-y-3 rounded-xl border p-4",
                      isYou ? "border-primary/35 bg-muted/50" : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        {ROLE_LABELS[role]}
                      </p>
                      {isYou ? (
                        <Badge variant="secondary" className="bg-primary/20 text-primary">
                          Auto-filled from your profile
                        </Badge>
                      ) : m.lookupStatus === "found" ? (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-400">
                          Profile found
                        </Badge>
                      ) : m.lookupStatus === "manual" ? (
                        <Badge className="border-transparent bg-orange-500/12 text-orange-800">
                          Manual entry
                        </Badge>
                      ) : null}
                    </div>

                    {showEmailLookup && (
                      <div className="space-y-2">
                        <Field label="Registered email" required>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              value={m.lookupEmail ?? ""}
                              onChange={(e) => updateMember(role, "lookupEmail", e.target.value.toLowerCase())}
                              placeholder="teammate@gmail.com"
                              readOnly={m.lookupStatus === "found"}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => lookupMember(role)}
                              disabled={isLoading || m.lookupStatus === "found"}
                              className="shrink-0 gap-1.5"
                            >
                              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                              Find
                            </Button>
                          </div>
                        </Field>

                        {m.lookupError && (
                          <Alert variant="destructive">
                            <AlertCircle />
                            <AlertDescription>{m.lookupError}</AlertDescription>
                          </Alert>
                        )}

                        {(m.lookupStatus === "idle" || m.lookupStatus === "not_found") && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => enableManualEntry(role)}
                            className="h-auto p-0 text-xs"
                          >
                            Enter details manually
                          </Button>
                        )}
                      </div>
                    )}

                    {showStudentIdLookup && (
                      <div className="space-y-2">
                        <Field label="Student ID" required>
                          <div className="flex gap-2">
                            <Input
                              value={m.studentId ?? ""}
                              onChange={(e) => updateMember(role, "studentId", e.target.value.toUpperCase())}
                              placeholder="e.g. SE/2021/014"
                              readOnly={m.lookupStatus === "found"}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => lookupMember(role)}
                              disabled={isLoading || m.lookupStatus === "found"}
                              className="shrink-0 gap-1.5"
                            >
                              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                              Find
                            </Button>
                          </div>
                        </Field>

                        {m.lookupError && (
                          <Alert variant="destructive">
                            <AlertCircle />
                            <AlertDescription>{m.lookupError}</AlertDescription>
                          </Alert>
                        )}

                        {(m.lookupStatus === "idle" || m.lookupStatus === "not_found") && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => enableManualEntry(role)}
                            className="h-auto p-0 text-xs"
                          >
                            Enter details manually without student ID
                          </Button>
                        )}
                      </div>
                    )}

                    {!isYou && m.lookupStatus === "manual" && !isExternal && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => enableStudentIdLookup(role)}
                        className="h-auto p-0 text-xs"
                      >
                        Look up by NSBM student ID instead
                      </Button>
                    )}

                    {!isYou && m.lookupStatus === "manual" && isExternal && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => enableEmailLookup(role)}
                        className="h-auto p-0 text-xs"
                      >
                        Look up by registered email instead
                      </Button>
                    )}

                    {isYou && !isExternal && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Student ID">
                          <Input value={m.studentId ?? ""} readOnly className="bg-muted/50" />
                        </Field>
                        <Field label="University email">
                          <Input type="email" value={m.universityEmail ?? m.personalEmail ?? ""} readOnly className="bg-muted/50" />
                        </Field>
                        <Field label="Full name">
                          <Input value={m.fullName ?? ""} readOnly className="bg-muted/50" />
                        </Field>
                        <Field label="Phone (WhatsApp)">
                          <Input value={m.phone ?? ""} readOnly className="bg-muted/50" />
                        </Field>
                        <Field label="NIC number" required>
                          <Input
                            value={m.nic ?? ""}
                            onChange={(e) => updateMember(role, "nic", e.target.value)}
                            placeholder="200012345678 or 991234567V"
                          />
                        </Field>
                      </div>
                    )}

                    {isYou && isExternal && (
                      <Field label="Registered email">
                        <Input type="email" value={m.personalEmail ?? ""} readOnly className="bg-muted/50" />
                      </Field>
                    )}

                    {showManualFields && !(isYou && !isExternal) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Full name" required>
                          <Input
                            value={m.fullName ?? ""}
                            onChange={(e) => updateMember(role, "fullName", e.target.value)}
                            placeholder="Full name"
                            readOnly={profileLinked}
                          />
                        </Field>
                        <Field label="Phone (WhatsApp)" required>
                          <Input
                            value={m.phone ?? ""}
                            onChange={(e) => updateMember(role, "phone", e.target.value)}
                            placeholder="+94771234567"
                            readOnly={profileLinked}
                          />
                        </Field>
                        {!isExternal && profileLinked && m.universityEmail && (
                          <Field label="University email">
                            <Input type="email" value={m.universityEmail} readOnly className="bg-muted/50 sm:col-span-2" />
                          </Field>
                        )}
                        {(isExternal || !profileLinked || m.lookupStatus === "manual") && (
                          <Field label={isExternal ? "Personal email" : "Contact email"} required>
                            <Input
                              type="email"
                              value={m.personalEmail ?? ""}
                              onChange={(e) => updateMember(role, "personalEmail", e.target.value)}
                              placeholder={isExternal ? "personal@email.com" : "name@students.nsbm.ac.lk"}
                              readOnly={profileLinked && isExternal && m.lookupStatus === "found"}
                            />
                          </Field>
                        )}
                        <Field label="NIC number" required>
                          <Input
                            value={m.nic ?? ""}
                            onChange={(e) => updateMember(role, "nic", e.target.value)}
                            placeholder="200012345678 or 991234567V"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {/* Additional event questions */}
            {questions.length > 0 && (
              <section className="space-y-4">
                <h4 className="text-sm font-bold text-foreground">
                  Additional questions
                </h4>
                {questions.map((q, i) => (
                  <div key={q._id ?? i}>
                    <Label className="mb-2 block text-sm font-semibold">
                      {q.question}
                      {q.isRequired && <span className="ml-1 text-destructive">*</span>}
                    </Label>

                    {q.questionType === "text" && (
                      <Textarea
                        value={answers[i]?.answer || ""}
                        onChange={(e) => updateAnswer(i, e.target.value)}
                        rows={2}
                        placeholder="Your answer…"
                        className="resize-none"
                      />
                    )}

                    {q.questionType === "dropdown" && (
                      <Select
                        value={answers[i]?.answer || ""}
                        onValueChange={(v) => updateAnswer(i, v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {q.questionType === "multiple_choice" && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            variant={answers[i]?.answer === opt ? "default" : "outline"}
                            onClick={() => updateAnswer(i, opt)}
                            className="h-auto justify-start px-3 py-2 text-left text-xs font-medium"
                          >
                            {answers[i]?.answer === opt && <Check size={11} className="mr-1.5" />}
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}

                    {q.questionType === "yes_no" && (
                      <div className="flex gap-3">
                        {["yes", "no"].map((v) => (
                          <Button
                            key={v}
                            type="button"
                            variant={answers[i]?.answer === v ? "default" : "outline"}
                            onClick={() => updateAnswer(i, v)}
                            className="flex-1 capitalize"
                          >
                            {v}
                          </Button>
                        ))}
                      </div>
                    )}

                    {q.questionType === "checkbox" && (
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const checked = Array.isArray(answers[i]?.answer) && answers[i].answer.includes(opt);
                          return (
                            <Button
                              key={opt}
                              type="button"
                              variant={checked ? "default" : "outline"}
                              onClick={() => toggleCheckbox(i, opt)}
                              className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left text-sm font-normal"
                            >
                              <div
                                className={cn(
                                  "flex size-4 shrink-0 items-center justify-center rounded",
                                  checked ? "bg-primary text-primary-foreground" : "border border-border bg-muted"
                                )}
                              >
                                {checked && <Check size={10} />}
                              </div>
                              {opt}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 border-t bg-background px-5 py-4">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant="gradient"
            className="w-full"
            size="lg"
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Submitting team…</>
              : <><Ticket size={16} /> Register Team</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
