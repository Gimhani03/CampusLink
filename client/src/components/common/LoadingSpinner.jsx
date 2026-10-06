import { Loader2 } from "lucide-react";
import BrandMark from "./BrandMark";
import { PLATFORM_NAME } from "@/constants/branding";

export default function LoadingSpinner() {
  return (
    <div className="min-h-dvh mesh-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size="md" className="animate-pulse" />
        <Loader2 className="size-8 animate-spin text-primary -mt-2" />
        <div className="text-center">
          <p className="font-display font-bold text-lg text-foreground">{PLATFORM_NAME}</p>
          <p className="text-xs mt-0.5 text-muted-foreground">Loading your events…</p>
        </div>
      </div>
    </div>
  );
}
