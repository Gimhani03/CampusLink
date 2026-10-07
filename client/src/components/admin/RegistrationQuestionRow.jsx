import {
  Plus, Trash2, GripVertical, ToggleLeft, ToggleRight, X, GraduationCap,
} from "lucide-react";
import {
  SRI_LANKAN_UNIVERSITIES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
} from "../../constants/registrationQuestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const hasOptions = (type) =>
  type === "multiple_choice" || type === "checkbox" || type === "dropdown";

/**
 * Admin row for a single event registration question.
 */
export default function RegistrationQuestionRow({ q, index, onChange, onRemove }) {
  const addOption = () => onChange({ ...q, options: [...(q.options || []), ""] });
  const updateOption = (i, v) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? v : o)) });
  const removeOption = (i) => onChange({ ...q, options: q.options.filter((_, j) => j !== i) });

  const insertUniversities = () => {
    onChange({ ...q, options: [...SRI_LANKAN_UNIVERSITIES] });
  };

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <GripVertical className="size-4 mt-2 shrink-0 cursor-grab text-muted-foreground/50" />

          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder={`Question ${index + 1}`}
                value={q.question}
                onChange={(e) => onChange({ ...q, question: e.target.value })}
                className="flex-1"
              />
              <Select
                value={q.questionType}
                onValueChange={(value) => onChange({ ...q, questionType: value, options: [] })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasOptions(q.questionType) && (
              <div className="space-y-2 pl-1">
                {(q.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="size-3 rounded-full shrink-0 border border-muted-foreground/50" />
                    <Input
                      type="text"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOption}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    <Plus className="size-3" /> Add option
                  </Button>

                  {q.questionType === "dropdown" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={insertUniversities}
                      className="h-7 text-xs border-primary/25 bg-primary/10 text-primary"
                    >
                      <GraduationCap className="size-3" /> Insert Sri Lankan universities
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...q, isRequired: !q.isRequired })}
              className={`h-7 text-xs ${q.isRequired ? "text-slate-700" : "text-muted-foreground"}`}
            >
              {q.isRequired ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
              Required
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="shrink-0 mt-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { UNIVERSITY_QUESTION_PRESET } from "../../constants/registrationQuestions";
