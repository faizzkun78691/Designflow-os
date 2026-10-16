import { useFieldArray, useFormContext } from "react-hook-form";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import type { TaskWizardValues } from "../schemas";

const KINDS = [
  { value: "inspiration", label: "Inspiration" },
  { value: "asset", label: "Asset" },
  { value: "guideline", label: "Brand guideline" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
] as const;

/** Dynamic label + URL + kind rows for the wizard's references section. */
export function ReferenceInputs() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<TaskWizardValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "references",
  });
  const rowErrors = errors.references;

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-token bg-surface/50 px-4 py-6 text-center text-sm text-subtle">
          No references yet. Add inspiration links, asset URLs or brand
          guidelines the designer should look at.
        </p>
      )}
      {fields.map((field, index) => {
        const err = Array.isArray(rowErrors) ? rowErrors[index] : undefined;
        return (
          <div
            key={field.id}
            className="grid grid-cols-1 gap-3 rounded-xl border border-token bg-surface p-3 sm:grid-cols-[1fr_1.4fr_9rem_auto] sm:items-start"
          >
            <div className="space-y-1.5">
              <Label htmlFor={`ref-label-${field.id}`}>Label</Label>
              <Input
                id={`ref-label-${field.id}`}
                placeholder="Moodboard"
                {...register(`references.${index}.label` as const)}
                error={!!err?.label}
              />
              {err?.label && (
                <p role="alert" className="text-xs text-red-400">
                  {err.label.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ref-url-${field.id}`}>URL</Label>
              <div className="relative">
                <Link2
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  id={`ref-url-${field.id}`}
                  placeholder="https://…"
                  inputMode="url"
                  className="pl-9"
                  {...register(`references.${index}.url` as const)}
                  error={!!err?.url}
                />
              </div>
              {err?.url && (
                <p role="alert" className="text-xs text-red-400">
                  {err.url.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ref-kind-${field.id}`}>Kind</Label>
              <Select
                id={`ref-kind-${field.id}`}
                {...register(`references.${index}.kind` as const)}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:pt-7">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label={`Remove reference ${index + 1}`}
                className="text-subtle hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        onClick={() => append({ label: "", url: "", kind: "reference" })}
        className="gap-2"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add reference
      </Button>
    </div>
  );
}
