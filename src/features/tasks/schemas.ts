/** Zod schemas for the task creation wizard (sections A–G). */
import { z } from "zod";
import { DEFAULT_TIMEZONE, zonedDateTimeToISO } from "../../utils/taskDates";

const PRIORITIES = ["low", "normal", "high", "urgent", "critical"] as const;
const VISIBILITIES = ["public", "private"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const REFERENCE_KINDS = [
  "inspiration",
  "asset",
  "guideline",
  "reference",
  "other",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .or(z.literal(""));

/** Number inputs use `setValueAs` at the field level so the schema's input
 *  and output types stay identical (keeps zodResolver + useForm generics
 *  aligned). */
const optionalInt = (min: number, max: number, label: string) =>
  z
    .number({ error: `Enter a valid ${label}.` })
    .int()
    .min(min)
    .max(max)
    .optional();

const optionalHours = z
  .number({ error: "Enter a valid number of hours." })
  .min(0, "Hours can't be negative.")
  .max(1000, "Keep it under 1000 hours.")
  .optional();

export const checklistItemSchema = z.object({
  text: z.string().trim().min(1, "Checklist items can't be empty.").max(200),
});

export const referenceSchema = z.object({
  label: z.string().trim().min(1, "Give each reference a label."),
  url: z.url("Enter a valid URL, starting with https://"),
  kind: z.enum(REFERENCE_KINDS),
});

const futureDateTimeRefine = (
  date: string | undefined,
  time: string | undefined,
  tz: string | undefined,
  ctx: z.RefinementCtx,
  datePath: (string | number)[],
) => {
  if (!date) return;
  if (!time) {
    ctx.addIssue({
      code: "custom",
      message: "Add a time for the deadline.",
      path: datePath,
    });
    return;
  }
  try {
    const iso = zonedDateTimeToISO(date, time, tz || DEFAULT_TIMEZONE);
    if (new Date(iso).getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        message: "The deadline must be in the future.",
        path: datePath,
      });
    }
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "That date/time is not valid.",
      path: datePath,
    });
  }
};

export const taskWizardSchema = z
  .object({
    /* A — Basic */
    title: z
      .string()
      .trim()
      .min(2, "Give the task a title (2–200 characters).")
      .max(200, "Keep the title under 200 characters."),
    description: optionalText(5000),
    campaign_name: optionalText(200),
    design_category: optionalText(200),
    target_platform: optionalText(200),
    priority: z.enum(PRIORITIES),
    deadline_date: z.string().optional().or(z.literal("")),
    deadline_time: z.string().optional().or(z.literal("")),
    deadline_timezone: z.string(),
    difficulty: z.enum(DIFFICULTIES).optional().or(z.literal("")),
    est_hours: optionalHours,

    /* B — Assignment */
    visibility: z.enum(VISIBILITIES),
    assignee_id: z.string().optional().or(z.literal("")),
    assign_lead_id: z.string().optional().or(z.literal("")),

    /* C — Spec */
    design_type: optionalText(200),
    preset: z.string(),
    width: z
      .number({ error: "Enter the width in pixels." })
      .int()
      .min(1)
      .max(10000),
    height: z
      .number({ error: "Enter the height in pixels." })
      .int()
      .min(1)
      .max(10000),
    orientation: z.string(),
    slides: optionalInt(1, 100, "slide count"),
    format: optionalText(100),
    source_file_required: z.boolean(),
    brand_colors: optionalText(500),
    fonts: optionalText(500),
    style: optionalText(1000),
    background: optionalText(1000),
    mandatory_elements: optionalText(2000),
    avoid_elements: optionalText(2000),

    /* D — Brief */
    objective: optionalText(5000),
    audience: optionalText(2000),
    headlines: optionalText(3000),
    mandatory_copy: optionalText(5000),
    concept: optionalText(5000),
    layout: optionalText(3000),
    color_type_instructions: optionalText(3000),
    brief_cta: optionalText(1000),
    brief_notes: optionalText(5000),

    /* E — References */
    references: z.array(referenceSchema).max(20, "Keep it to 20 references."),

    /* F — Social */
    caption: optionalText(2200),
    hashtags: optionalText(1000),
    mentions: optionalText(1000),
    social_cta: optionalText(1000),
    social_platform: optionalText(100),
    publish_date: z.string().optional().or(z.literal("")),
    publish_time: z.string().optional().or(z.literal("")),
    social_instructions: optionalText(3000),

    /* G — Checklist */
    checklist: z
      .array(checklistItemSchema)
      .max(30, "Keep it to 30 checklist items."),
  })
  .superRefine((v, ctx) => {
    futureDateTimeRefine(v.deadline_date, v.deadline_time, v.deadline_timezone, ctx, [
      "deadline_date",
    ]);
    futureDateTimeRefine(v.publish_date, v.publish_time, v.deadline_timezone, ctx, [
      "publish_date",
    ]);
    if (v.visibility === "private" && !v.assignee_id && !v.assign_lead_id) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a designer or a team lead for a private task.",
        path: ["assignee_id"],
      });
    }
  });

export type TaskWizardValues = z.infer<typeof taskWizardSchema>;

export const WIZARD_DEFAULTS: TaskWizardValues = {
  title: "",
  description: "",
  campaign_name: "",
  design_category: "",
  target_platform: "",
  priority: "normal",
  deadline_date: "",
  deadline_time: "",
  deadline_timezone: DEFAULT_TIMEZONE,
  difficulty: "",
  est_hours: undefined,
  visibility: "private",
  assignee_id: "",
  assign_lead_id: "",
  design_type: "",
  preset: "instagram-square",
  width: 1080,
  height: 1080,
  orientation: "auto",
  slides: undefined,
  format: "",
  source_file_required: false,
  brand_colors: "",
  fonts: "",
  style: "",
  background: "",
  mandatory_elements: "",
  avoid_elements: "",
  objective: "",
  audience: "",
  headlines: "",
  mandatory_copy: "",
  concept: "",
  layout: "",
  color_type_instructions: "",
  brief_cta: "",
  brief_notes: "",
  references: [],
  caption: "",
  hashtags: "",
  mentions: "",
  social_cta: "",
  social_platform: "",
  publish_date: "",
  publish_time: "",
  social_instructions: "",
  checklist: [],
};

/** Field paths validated per wizard step (used with form.trigger). */
export const WIZARD_STEP_FIELDS: Record<string, (keyof TaskWizardValues)[]> = {
  basic: [
    "title",
    "description",
    "campaign_name",
    "design_category",
    "target_platform",
    "priority",
    "deadline_date",
    "deadline_time",
    "deadline_timezone",
    "difficulty",
    "est_hours",
  ],
  assignment: ["visibility", "assignee_id", "assign_lead_id"],
  spec: [
    "design_type",
    "preset",
    "width",
    "height",
    "orientation",
    "slides",
    "format",
    "source_file_required",
    "brand_colors",
    "fonts",
    "style",
    "background",
    "mandatory_elements",
    "avoid_elements",
  ],
  brief: [
    "objective",
    "audience",
    "headlines",
    "mandatory_copy",
    "concept",
    "layout",
    "color_type_instructions",
    "brief_cta",
    "brief_notes",
  ],
  references: ["references"],
  social: [
    "caption",
    "hashtags",
    "mentions",
    "social_cta",
    "social_platform",
    "publish_date",
    "publish_time",
    "social_instructions",
  ],
  checklist: ["checklist"],
  review: [],
};
