import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Controller,
  FormProvider,
  get,
  useForm,
  useFormContext,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Eye,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  PenTool,
  Share2,
  UserCheck,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { toast } from "../../../components/ui/toaster";
import { useAuth } from "../../../contexts/AuthContext";
import { cn } from "../../../utils/cn";
import { formatDateTime, TIMEZONES, zonedDateTimeToISO } from "../../../utils/taskDates";
import {
  DESIGN_TYPES,
  DIMENSION_PRESETS,
  DIFFICULTIES,
  ORIENTATIONS,
  OUTPUT_FORMATS,
  SOCIAL_PLATFORMS,
  type DimensionPreset,
} from "../presets";
import {
  taskWizardSchema,
  WIZARD_DEFAULTS,
  WIZARD_STEP_FIELDS,
  type TaskWizardValues,
} from "../schemas";
import { resolvePeople } from "../services/tasks";
import { useCreateTask } from "../hooks";
import { ChecklistBuilder } from "./ChecklistBuilder";
import { ReferenceInputs } from "./ReferenceInputs";
import { WorkloadPicker } from "./WorkloadPicker";
import type { CreateTaskPayload, TaskPriority, TaskVisibility } from "../../../types/tasks";

const STEPS = [
  { key: "basic", label: "Basic info", icon: FileText },
  { key: "assignment", label: "Assignment", icon: UserCheck },
  { key: "spec", label: "Design spec", icon: PenTool },
  { key: "brief", label: "Design brief", icon: ClipboardList },
  { key: "references", label: "References", icon: Link2 },
  { key: "social", label: "Social content", icon: Share2 },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "review", label: "Review", icon: Eye },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" },
];

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */

function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="font-normal text-subtle"> (optional)</span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted">{description}</p>
      )}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-token bg-surface-2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-[36px] rounded-lg px-3.5 text-sm font-medium transition-colors",
              active
                ? "bg-volt font-semibold text-white"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function useFieldError() {
  const {
    formState: { errors },
  } = useFormContext<TaskWizardValues>();
  return (name: FieldPath<TaskWizardValues>): string | undefined => {
    const e = get(errors, name) as { message?: unknown } | undefined;
    return typeof e?.message === "string" ? e.message : undefined;
  };
}

function clean(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* sections A–G                                                        */
/* ------------------------------------------------------------------ */

function SectionBasic() {
  const { register, control } =
    useFormContext<TaskWizardValues>();
  const err = useFieldError();
  const today = TODAY_ISO;

  return (
    <SectionCard
      title="Basic info"
      description="What is this task, how urgent is it, and when is it due?"
    >
      <Field label="Task code" hint="Assigned automatically on create.">
        <Input value="DF-####" disabled aria-label="Task code (auto-assigned)" />
      </Field>
      <Field label="Title" htmlFor="w-title" error={err("title")}>
        <Input
          id="w-title"
          placeholder="E.g. Instagram launch post for the summer campaign"
          {...register("title")}
          error={!!err("title")}
        />
      </Field>
      <Field label="Description" htmlFor="w-desc" optional error={err("description")}>
        <Textarea
          id="w-desc"
          placeholder="One or two lines on what needs to be designed…"
          rows={3}
          {...register("description")}
          error={!!err("description")}
        />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Campaign" htmlFor="w-campaign" optional>
          <Input id="w-campaign" placeholder="Summer 2026" {...register("campaign_name")} />
        </Field>
        <Field label="Design category" htmlFor="w-category" optional>
          <Input id="w-category" placeholder="Social media" {...register("design_category")} />
        </Field>
        <Field label="Target platform" htmlFor="w-platform" optional>
          <Input id="w-platform" placeholder="Instagram" {...register("target_platform")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Priority" error={err("priority")}>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Segmented
                ariaLabel="Priority"
                options={PRIORITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label="Difficulty" htmlFor="w-difficulty" optional>
          <Select id="w-difficulty" {...register("difficulty")}>
            <option value="">Not set</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Deadline date" htmlFor="w-date" optional error={err("deadline_date")}>
          <Input
            id="w-date"
            type="date"
            min={today}
            {...register("deadline_date")}
            error={!!err("deadline_date")}
          />
        </Field>
        <Field label="Deadline time" htmlFor="w-time" optional error={err("deadline_time")}>
          <Input
            id="w-time"
            type="time"
            {...register("deadline_time")}
            error={!!err("deadline_time")}
          />
        </Field>
        <Field label="Timezone" htmlFor="w-tz" optional>
          <Select id="w-tz" {...register("deadline_timezone")}>
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="max-w-xs">
        <Field
          label="Estimated hours"
          htmlFor="w-hours"
          optional
          error={err("est_hours")}
          hint="Rough effort estimate for planning."
        >
          <Input
            id="w-hours"
            type="number"
            min={0}
            step={0.5}
            placeholder="4"
            {...register("est_hours", {
              setValueAs: (v) =>
                v === "" || v == null ? undefined : Number(v),
            })}
            error={!!err("est_hours")}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function SectionAssignment({ lockedPrivate }: { lockedPrivate: boolean }) {
  const { watch, setValue } = useFormContext<TaskWizardValues>();
  const err = useFieldError();
  const visibility = watch("visibility");
  const assigneeId = watch("assignee_id") ?? "";
  const assignLeadId = watch("assign_lead_id") ?? "";

  return (
    <SectionCard
      title="Assignment"
      description="Who should work on this task?"
    >
      {lockedPrivate ? (
        <div className="rounded-xl border border-volt/30 bg-volt/5 p-4">
          <p className="text-sm font-semibold text-volt">Private task only</p>
          <p className="mt-1 text-sm text-muted">
            Organizers create private tasks and assign them directly to a
            designer, or route them to a team lead who briefs them out.
          </p>
        </div>
      ) : (
        <Field label="Visibility">
          <Segmented<TaskVisibility>
            ariaLabel="Task visibility"
            options={[
              { value: "private", label: "Private" },
              { value: "public", label: "Public" },
            ]}
            value={visibility}
            onChange={(v) => setValue("visibility", v, { shouldValidate: true })}
          />
          <p className="mt-1.5 text-xs text-subtle">
            {visibility === "public"
              ? "Public tasks appear on the board for any designer to claim."
              : "Private tasks go straight to the person you choose below."}
          </p>
        </Field>
      )}

      {visibility === "private" && (
        <div className="space-y-6">
          <WorkloadPicker
            label="Assign to designer"
            hint="Live workload is shown per designer."
            memberRole="designer"
            value={assigneeId}
            onChange={(id) => setValue("assignee_id", id, { shouldValidate: true })}
            error={err("assignee_id")}
            required
          />
          <WorkloadPicker
            label="Or route to team lead"
            hint="The lead will brief this out to their designers."
            memberRole="team_lead"
            value={assignLeadId}
            onChange={(id) => setValue("assign_lead_id", id, { shouldValidate: true })}
          />
        </div>
      )}
    </SectionCard>
  );
}

function SectionSpec() {
  const { register, control, watch, setValue } =
    useFormContext<TaskWizardValues>();
  const err = useFieldError();
  const preset = watch("preset");
  const width = watch("width");
  const height = watch("height");
  const isCustom = preset === "custom";

  const selectPreset = (p: DimensionPreset) => {
    setValue("preset", p.key);
    if (p.key !== "custom") {
      setValue("width", p.width, { shouldValidate: true });
      setValue("height", p.height, { shouldValidate: true });
    }
  };

  return (
    <SectionCard
      title="Design spec"
      description="Dimensions, format and production requirements."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Design type" htmlFor="w-dtype" optional>
          <Select id="w-dtype" {...register("design_type")}>
            <option value="">Select…</option>
            {DESIGN_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Output format" htmlFor="w-format" optional>
          <Select id="w-format" {...register("format")}>
            <option value="">Select…</option>
            {OUTPUT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Dimensions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {DIMENSION_PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p)}
                aria-pressed={active}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-volt/60 bg-volt/10"
                    : "border-token bg-surface-2 hover:border-token-strong",
                )}
              >
                <span className={cn("block text-sm font-semibold", active ? "text-volt" : "text-fg")}>
                  {p.label}
                </span>
                <span className="mt-0.5 block text-xs text-subtle">
                  {p.key === "custom"
                    ? p.hint
                    : `${p.width} × ${p.height} · ${p.hint}`}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Field label="Width (px)" htmlFor="w-width" error={err("width")}>
          <Input
            id="w-width"
            type="number"
            min={1}
            disabled={!isCustom}
            {...register("width", {
              setValueAs: (v) =>
                v === "" || v == null ? undefined : Number(v),
            })}
            error={!!err("width")}
          />
        </Field>
        <Field label="Height (px)" htmlFor="w-height" error={err("height")}>
          <Input
            id="w-height"
            type="number"
            min={1}
            disabled={!isCustom}
            {...register("height", {
              setValueAs: (v) =>
                v === "" || v == null ? undefined : Number(v),
            })}
            error={!!err("height")}
          />
        </Field>
        <Field label="Orientation" htmlFor="w-orient" optional>
          <Select id="w-orient" {...register("orientation")}>
            {ORIENTATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Slides / pages" htmlFor="w-slides" optional error={err("slides")}>
          <Input
            id="w-slides"
            type="number"
            min={1}
            placeholder="1"
            {...register("slides", {
              setValueAs: (v) =>
                v === "" || v == null ? undefined : Number(v),
            })}
            error={!!err("slides")}
          />
        </Field>
      </div>
      {!isCustom && (
        <p className="text-xs text-subtle">
          Effective size: {width} × {height} px. Choose “Custom” to edit.
        </p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-xl border border-token bg-surface-2 p-4">
        <div>
          <p className="text-sm font-medium text-fg">Source file required</p>
          <p className="text-xs text-subtle">
            Designer must hand over the editable source (Figma/PSD/AI).
          </p>
        </div>
        <Controller
          control={control}
          name="source_file_required"
          render={({ field }) => (
            <Switch
              id="w-source"
              checked={field.value}
              onCheckedChange={field.onChange}
              label="Source file required"
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Brand colors" htmlFor="w-colors" optional hint="Hex codes or palette notes.">
          <Input id="w-colors" placeholder="#8B35FF, #100B2B" {...register("brand_colors")} />
        </Field>
        <Field label="Fonts" htmlFor="w-fonts" optional>
          <Input id="w-fonts" placeholder="Space Grotesk, Inter" {...register("fonts")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Style direction" htmlFor="w-style" optional>
          <Textarea id="w-style" rows={3} placeholder="Minimal, bold typography, dark…" {...register("style")} />
        </Field>
        <Field label="Background" htmlFor="w-bg" optional>
          <Textarea id="w-bg" rows={3} placeholder="Matte black with subtle grain…" {...register("background")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Must include" htmlFor="w-must" optional>
          <Textarea id="w-must" rows={3} placeholder="Logo, tagline, CTA button…" {...register("mandatory_elements")} />
        </Field>
        <Field label="Avoid" htmlFor="w-avoid" optional>
          <Textarea id="w-avoid" rows={3} placeholder="Stock photos, gradients…" {...register("avoid_elements")} />
        </Field>
      </div>
    </SectionCard>
  );
}

const BRIEF_FIELDS: {
  name: FieldPath<TaskWizardValues>;
  label: string;
  placeholder: string;
}[] = [
  { name: "objective", label: "Objective", placeholder: "What should this design achieve?" },
  { name: "audience", label: "Target audience", placeholder: "Who is this for?" },
  { name: "headlines", label: "Headlines", placeholder: "Primary headline, sub-headline…" },
  { name: "mandatory_copy", label: "Mandatory copy", placeholder: "Exact text that must appear." },
  { name: "concept", label: "Concept", placeholder: "The creative idea in a few lines." },
  { name: "layout", label: "Layout guidance", placeholder: "Composition notes…" },
  { name: "color_type_instructions", label: "Color & typography", placeholder: "Color usage, type hierarchy…" },
  { name: "brief_cta", label: "Call to action", placeholder: "What should the viewer do?" },
  { name: "brief_notes", label: "Additional notes", placeholder: "Anything else the designer should know." },
];

function SectionBrief() {
  const { register } = useFormContext<TaskWizardValues>();
  const err = useFieldError();
  return (
    <SectionCard
      title="Design brief"
      description="The full creative brief. Write freely — nothing here is truncated."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {BRIEF_FIELDS.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`w-${f.name}`} optional error={err(f.name)}>
            <Textarea
              id={`w-${f.name}`}
              rows={4}
              placeholder={f.placeholder}
              {...register(f.name)}
              error={!!err(f.name)}
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

function SectionReferences() {
  return (
    <SectionCard
      title="References"
      description="Links the designer should look at before starting."
    >
      <ReferenceInputs />
    </SectionCard>
  );
}

function SectionSocial() {
  const { register, watch } = useFormContext<TaskWizardValues>();
  const err = useFieldError();
  const caption = watch("caption") ?? "";
  const today = TODAY_ISO;
  return (
    <SectionCard
      title="Social content"
      description="Caption and publishing notes for the social media team."
    >
      <Field
        label="Caption"
        htmlFor="w-caption"
        optional
        error={err("caption")}
        hint={`${caption.length} / 2200 characters`}
      >
        <Textarea
          id="w-caption"
          rows={5}
          placeholder="Write the post caption…"
          {...register("caption")}
          error={!!err("caption")}
        />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Hashtags" htmlFor="w-tags" optional>
          <Input id="w-tags" placeholder="#design #branding" {...register("hashtags")} />
        </Field>
        <Field label="Mentions" htmlFor="w-mentions" optional>
          <Input id="w-mentions" placeholder="@partner" {...register("mentions")} />
        </Field>
        <Field label="Call to action" htmlFor="w-scta" optional>
          <Input id="w-scta" placeholder="Shop now" {...register("social_cta")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Platform" htmlFor="w-splatform" optional>
          <Select id="w-splatform" {...register("social_platform")}>
            <option value="">Select…</option>
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred publish date" htmlFor="w-pdate" optional error={err("publish_date")}>
          <Input id="w-pdate" type="date" min={today} {...register("publish_date")} error={!!err("publish_date")} />
        </Field>
        <Field label="Preferred publish time" htmlFor="w-ptime" optional error={err("publish_time")}>
          <Input id="w-ptime" type="time" {...register("publish_time")} error={!!err("publish_time")} />
        </Field>
      </div>
      <Field label="Instructions for the social team" htmlFor="w-sinstr" optional>
        <Textarea id="w-sinstr" rows={3} placeholder="Scheduling notes, tagging order…" {...register("social_instructions")} />
      </Field>
    </SectionCard>
  );
}

function SectionChecklist() {
  return (
    <SectionCard
      title="Checklist"
      description="Steps the designer ticks off while working."
    >
      <ChecklistBuilder />
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* review                                                              */
/* ------------------------------------------------------------------ */

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-subtle">
        {label}
      </dt>
      <dd className="text-sm text-fg">{value ?? "—"}</dd>
    </div>
  );
}

function ReviewSection({
  title,
  step,
  goTo,
  children,
}: {
  title: string;
  step: number;
  goTo: (s: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-token bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => goTo(step)}>
          Edit
        </Button>
      </div>
      <dl className="mt-2 divide-y divide-[var(--border)]">{children}</dl>
    </div>
  );
}

function SectionReview({ goTo }: { goTo: (s: number) => void }) {
  const { watch } = useFormContext<TaskWizardValues>();
  const v = watch();
  const ids = [v.assignee_id, v.assign_lead_id].filter(Boolean) as string[];
  const { data: people } = useQuery({
    queryKey: ["people", ids],
    queryFn: () => resolvePeople(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  const nameOf = (id?: string) =>
    id ? (people?.get(id)?.name ?? "Selected") : "—";

  let deadline = "—";
  if (v.deadline_date && v.deadline_time) {
    try {
      deadline = formatDateTime(
        zonedDateTimeToISO(v.deadline_date, v.deadline_time, v.deadline_timezone),
      );
    } catch {
      deadline = `${v.deadline_date} ${v.deadline_time}`;
    }
  }
  let publishAt = "—";
  if (v.publish_date && v.publish_time) {
    try {
      publishAt = formatDateTime(
        zonedDateTimeToISO(v.publish_date, v.publish_time, v.deadline_timezone),
      );
    } catch {
      publishAt = `${v.publish_date} ${v.publish_time}`;
    }
  }

  const longText = (s?: string) =>
    s ? <span className="whitespace-pre-wrap">{s}</span> : "—";

  return (
    <SectionCard
      title="Review"
      description="Check everything once. You can save as a draft or publish right away."
    >
      <div className="space-y-3">
        <ReviewSection title="Basic info" step={0} goTo={goTo}>
          <ReviewRow label="Title" value={v.title || "—"} />
          <ReviewRow label="Description" value={longText(v.description)} />
          <ReviewRow
            label="Priority"
            value={<Badge variant="default" className="capitalize">{v.priority}</Badge>}
          />
          <ReviewRow label="Deadline" value={deadline} />
          <ReviewRow label="Campaign" value={v.campaign_name || "—"} />
          <ReviewRow label="Category" value={v.design_category || "—"} />
          <ReviewRow label="Platform" value={v.target_platform || "—"} />
          <ReviewRow label="Difficulty" value={v.difficulty || "—"} />
          <ReviewRow label="Est. hours" value={v.est_hours ?? "—"} />
        </ReviewSection>

        <ReviewSection title="Assignment" step={1} goTo={goTo}>
          <ReviewRow
            label="Visibility"
            value={<span className="capitalize">{v.visibility}</span>}
          />
          {v.visibility === "private" && (
            <>
              <ReviewRow label="Designer" value={nameOf(v.assignee_id)} />
              <ReviewRow label="Team lead" value={nameOf(v.assign_lead_id)} />
            </>
          )}
        </ReviewSection>

        <ReviewSection title="Design spec" step={2} goTo={goTo}>
          <ReviewRow label="Type" value={v.design_type || "—"} />
          <ReviewRow label="Dimensions" value={`${v.width} × ${v.height} px`} />
          <ReviewRow label="Orientation" value={v.orientation} />
          <ReviewRow label="Slides" value={v.slides ?? "—"} />
          <ReviewRow label="Format" value={v.format || "—"} />
          <ReviewRow label="Source file" value={v.source_file_required ? "Required" : "Not required"} />
          <ReviewRow label="Brand colors" value={v.brand_colors || "—"} />
          <ReviewRow label="Fonts" value={v.fonts || "—"} />
          <ReviewRow label="Style" value={longText(v.style)} />
          <ReviewRow label="Background" value={longText(v.background)} />
          <ReviewRow label="Must include" value={longText(v.mandatory_elements)} />
          <ReviewRow label="Avoid" value={longText(v.avoid_elements)} />
        </ReviewSection>

        <ReviewSection title="Design brief" step={3} goTo={goTo}>
          <ReviewRow label="Objective" value={longText(v.objective)} />
          <ReviewRow label="Audience" value={longText(v.audience)} />
          <ReviewRow label="Headlines" value={longText(v.headlines)} />
          <ReviewRow label="Mandatory copy" value={longText(v.mandatory_copy)} />
          <ReviewRow label="Concept" value={longText(v.concept)} />
          <ReviewRow label="Layout" value={longText(v.layout)} />
          <ReviewRow label="Color & type" value={longText(v.color_type_instructions)} />
          <ReviewRow label="CTA" value={longText(v.brief_cta)} />
          <ReviewRow label="Notes" value={longText(v.brief_notes)} />
        </ReviewSection>

        <ReviewSection title="References" step={4} goTo={goTo}>
          <ReviewRow
            label={`${v.references.length} link(s)`}
            value={
              v.references.length > 0 ? (
                <ul className="space-y-1">
                  {v.references.map((r, i) => (
                    <li key={i} className="truncate">
                      <span className="text-volt">{r.label}</span>
                      <span className="text-subtle"> · {r.kind} · </span>
                      <span className="text-muted">{r.url}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )
            }
          />
        </ReviewSection>

        <ReviewSection title="Social content" step={5} goTo={goTo}>
          <ReviewRow label="Caption" value={longText(v.caption)} />
          <ReviewRow label="Hashtags" value={v.hashtags || "—"} />
          <ReviewRow label="Mentions" value={v.mentions || "—"} />
          <ReviewRow label="CTA" value={v.social_cta || "—"} />
          <ReviewRow label="Platform" value={v.social_platform || "—"} />
          <ReviewRow label="Publish at" value={publishAt} />
          <ReviewRow label="Instructions" value={longText(v.social_instructions)} />
        </ReviewSection>

        <ReviewSection title="Checklist" step={6} goTo={goTo}>
          <ReviewRow
            label={`${v.checklist.length} item(s)`}
            value={
              v.checklist.length > 0 ? (
                <ol className="list-decimal space-y-0.5 pl-5">
                  {v.checklist.map((c, i) => (
                    <li key={i}>{c.text}</li>
                  ))}
                </ol>
              ) : (
                "—"
              )
            }
          />
        </ReviewSection>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* wizard                                                              */
/* ------------------------------------------------------------------ */

export function TaskFormWizard({ detailBase }: { detailBase: string }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const create = useCreateTask();
  const [step, setStep] = useState(0);

  const lockedPrivate = role === "organizer";

  const form = useForm<TaskWizardValues>({
    resolver: zodResolver(taskWizardSchema),
    defaultValues: { ...WIZARD_DEFAULTS, visibility: "private" },
    mode: "onTouched",
  });

  const goTo = (s: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, s)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    const key = STEPS[step].key as StepKey;
    const fields = WIZARD_STEP_FIELDS[key] as FieldPath<TaskWizardValues>[];
    const ok = await form.trigger(fields);
    if (ok) goTo(step + 1);
    else {
      const firstError = document.querySelector('[aria-invalid="true"]');
      firstError?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const buildPayload = (v: TaskWizardValues, publish: boolean): CreateTaskPayload => {
    let due_date: string | null = null;
    if (v.deadline_date && v.deadline_time) {
      due_date = zonedDateTimeToISO(v.deadline_date, v.deadline_time, v.deadline_timezone);
    }
    let preferred_publish_at: string | null = null;
    if (v.publish_date && v.publish_time) {
      preferred_publish_at = zonedDateTimeToISO(v.publish_date, v.publish_time, v.deadline_timezone);
    }
    return {
      title: v.title.trim(),
      description: v.description?.trim() || undefined,
      visibility: v.visibility,
      priority: v.priority,
      due_date,
      timezone: v.deadline_timezone,
      difficulty: v.difficulty || undefined,
      est_hours: v.est_hours ?? null,
      campaign_name: v.campaign_name?.trim() || undefined,
      design_category: v.design_category?.trim() || undefined,
      target_platform: v.target_platform?.trim() || undefined,
      assignee_id: v.assignee_id || null,
      assign_lead_id: v.assign_lead_id || null,
      publish,
      spec: clean({
        design_type: v.design_type,
        preset: v.preset,
        width: v.width,
        height: v.height,
        orientation: v.orientation,
        slides: v.slides,
        format: v.format,
        source_file_required: v.source_file_required,
        brand_colors: v.brand_colors,
        fonts: v.fonts,
        style: v.style,
        background: v.background,
        mandatory_elements: v.mandatory_elements,
        avoid_elements: v.avoid_elements,
      }),
      brief: clean({
        objective: v.objective,
        audience: v.audience,
        headlines: v.headlines,
        mandatory_copy: v.mandatory_copy,
        concept: v.concept,
        layout: v.layout,
        color_type_instructions: v.color_type_instructions,
        cta: v.brief_cta,
        notes: v.brief_notes,
      }),
      social: clean({
        caption: v.caption,
        hashtags: v.hashtags,
        mentions: v.mentions,
        cta: v.social_cta,
        platform: v.social_platform,
        preferred_publish_at,
        instructions: v.social_instructions,
      }),
      references: v.references.map((r) => ({
        label: r.label.trim(),
        url: r.url.trim(),
        kind: r.kind,
      })),
      checklist: v.checklist.map((c) => c.text.trim()).filter(Boolean),
    };
  };

  const finish = (publish: boolean) =>
    form.handleSubmit((values) => {
      if (create.isPending) return;
      const payload = buildPayload(values, publish);
      create.mutate(payload, {
        onSuccess: (res) => {
          toast.success(
            publish
              ? `Task ${res.task_code ?? ""} published.`.trim()
              : `Draft ${res.task_code ?? ""} saved.`.trim(),
          );
          navigate(`${detailBase}/${res.task_id}`, {
            state: {
              duplicateWarning: res.duplicate_warning,
              justCreated: true,
            },
          });
        },
      });
    })();

  const isLast = step === STEPS.length - 1;
  const busy = create.isPending;

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Stepper with progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold text-fg" aria-live="polite">
              Step {step + 1} of {STEPS.length}
              <span className="ml-2 font-sans font-normal text-muted">
                {STEPS[step].label}
              </span>
            </p>
            <p className="text-xs text-subtle">
              {Math.round(((step + 1) / STEPS.length) * 100)}% complete
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="Task creation progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-volt-dim to-volt transition-[width] duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        <nav aria-label="Task creation steps">
          <ol className="flex gap-1.5 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              const Icon = s.icon;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => i <= step && goTo(i)}
                    disabled={i > step}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      current
                        ? "border-volt/60 bg-volt/10 text-volt"
                        : done
                          ? "border-token bg-surface-2 text-fg hover:border-token-strong"
                          : "cursor-not-allowed border-token bg-transparent text-subtle",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Icon className="size-3.5" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {i + 1}. {s.label}
                    </span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Active section */}
        <div key={step} className="animate-fade-in">
          {step === 0 && <SectionBasic />}
          {step === 1 && <SectionAssignment lockedPrivate={lockedPrivate} />}
          {step === 2 && <SectionSpec />}
          {step === 3 && <SectionBrief />}
          {step === 4 && <SectionReferences />}
          {step === 5 && <SectionSocial />}
          {step === 6 && <SectionChecklist />}
          {step === 7 && <SectionReview goTo={goTo} />}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 border-t border-token pt-5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => goTo(step - 1)}
            disabled={step === 0 || busy}
            className="gap-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>

          {!isLast ? (
            <Button type="button" onClick={next} disabled={busy} className="gap-2">
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => finish(false)}
                disabled={busy}
                className="gap-2"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Save as draft
              </Button>
              <Button
                type="button"
                onClick={() => finish(true)}
                disabled={busy}
                className="gap-2"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busy ? "Creating…" : "Publish task"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  );
}
