/**
 * Shows built-in fields for team/hackathon registration in admin create/edit forms.
 * University is collected once per team — not as a custom additional question.
 */

import { GraduationCap, Users, Check } from "lucide-react";
import { SRI_LANKAN_UNIVERSITIES } from "../../constants/registrationQuestions";
import { POSITION_OPTIONS } from "../../constants/teamRegistration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const BuiltInField = ({ icon: Icon, title, detail, badge = "Included" }) => (
  <Card className="py-0">
    <CardContent className="p-3 flex items-start gap-3">
      <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/15">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{title}</p>
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0">
            <Check className="size-2.5 mr-1" /> {badge}
          </Badge>
        </div>
        <p className="text-xs mt-1 leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </CardContent>
  </Card>
);

export default function TeamRegistrationFieldsPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Team registration fields
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="text-xs border-primary/45 bg-primary/10 text-primary"
          title="Always included for team registration"
        >
          <GraduationCap className="size-3.5" /> University Question
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        These are shown automatically when a student registers a team. You do not add them as custom questions below.
      </p>

      <div className="space-y-2">
        <BuiltInField
          icon={Users}
          title="Team name"
          detail="Text field — required for every team."
        />
        <BuiltInField
          icon={GraduationCap}
          title="University Question"
          detail={`Dropdown — "Which university is your team from?" Required once per team. ${SRI_LANKAN_UNIVERSITIES.length} Sri Lankan universities (${SRI_LANKAN_UNIVERSITIES.slice(0, 3).join(", ")}, …).`}
        />
        <BuiltInField
          icon={Users}
          title="Team positions"
          detail={`Registrant picks their slot: ${POSITION_OPTIONS.join(", ")}. Name + WhatsApp auto-filled for their slot.`}
        />
        <BuiltInField
          icon={Users}
          title="Team member limit"
          detail="Set minimum team size and member limit per team below. Students pick a size within that range."
        />
      </div>
    </div>
  );
}
