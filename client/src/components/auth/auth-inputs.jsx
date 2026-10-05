import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const innerInput =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground";

const fieldShell =
  "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-background/80 px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";

export const PasswordInput = ({
  value,
  onChange,
  placeholder,
  id,
  autoComplete = "current-password",
  className,
}) => {
  const [show, setShow] = useState(false);

  return (
    <div className={cn(fieldShell, className)}>
      <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder ?? "••••••••"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        spellCheck={false}
        className={innerInput}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? (
          <Eye className="size-4" strokeWidth={2} />
        ) : (
          <EyeOff className="size-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
};

export const TextInput = ({
  id,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  className,
}) => (
  <div className={cn(fieldShell, className)}>
    {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      className={innerInput}
    />
  </div>
);
