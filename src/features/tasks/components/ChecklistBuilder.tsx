import { useFieldArray, useFormContext } from "react-hook-form";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import type { TaskWizardValues } from "../schemas";

/** Dynamic checklist builder for the wizard (section G). Enter adds an item. */
export function ChecklistBuilder() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<TaskWizardValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "checklist",
  });
  const rowErrors = errors.checklist;

  const addItem = () => append({ text: "" });

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-token bg-surface/50 px-4 py-6 text-sm text-subtle">
          <ListChecks className="size-5 shrink-0" aria-hidden="true" />
          <p>
            Break the work into checkable steps — the designer ticks them off
            as they go.
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {fields.map((field, index) => {
          const err = Array.isArray(rowErrors)
            ? rowErrors[index]?.text?.message
            : undefined;
          return (
            <li key={field.id} className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-subtle"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <Input
                placeholder={`Step ${index + 1} — e.g. Export final PNGs`}
                aria-label={`Checklist item ${index + 1}`}
                {...register(`checklist.${index}.text` as const)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                error={!!err}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label={`Remove checklist item ${index + 1}`}
                className="shrink-0 text-subtle hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      {typeof errors.checklist?.message === "string" && (
        <p role="alert" className="text-xs text-red-400">
          {errors.checklist.message}
        </p>
      )}
      <Button type="button" variant="secondary" onClick={addItem} className="gap-2">
        <Plus className="size-4" aria-hidden="true" />
        Add checklist item
      </Button>
    </div>
  );
}
