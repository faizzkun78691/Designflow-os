/** Dimension presets + option lists for the task wizard's design-spec section. */

export interface DimensionPreset {
  key: string;
  label: string;
  width: number;
  height: number;
  hint: string;
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  {
    key: "instagram-square",
    label: "Instagram Square",
    width: 1080,
    height: 1080,
    hint: "Feed post",
  },
  {
    key: "instagram-portrait",
    label: "Instagram Portrait",
    width: 1080,
    height: 1350,
    hint: "Feed post 4:5",
  },
  {
    key: "instagram-story",
    label: "Instagram Story",
    width: 1080,
    height: 1920,
    hint: "Story / Reel 9:16",
  },
  {
    key: "youtube-thumbnail",
    label: "YouTube Thumbnail",
    width: 1280,
    height: 720,
    hint: "16:9",
  },
  {
    key: "facebook-cover",
    label: "Facebook Cover",
    width: 820,
    height: 312,
    hint: "Page cover",
  },
  {
    key: "linkedin-post",
    label: "LinkedIn Post",
    width: 1200,
    height: 627,
    hint: "Link / image post",
  },
  { key: "custom", label: "Custom", width: 0, height: 0, hint: "Your own size" },
];

export const DESIGN_TYPES = [
  "Social media post",
  "Story / Reel cover",
  "Carousel",
  "Thumbnail",
  "Banner / Cover",
  "Logo / Brand mark",
  "Flyer / Poster",
  "Ad creative",
  "Presentation slide",
  "Other",
] as const;

export const OUTPUT_FORMATS = [
  "PNG",
  "JPG",
  "PDF",
  "SVG",
  "MP4",
  "GIF",
  "Figma file",
  "PSD",
] as const;

export const ORIENTATIONS = [
  { value: "auto", label: "Auto (from dimensions)" },
  { value: "square", label: "Square" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
] as const;

export const SOCIAL_PLATFORMS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "X (Twitter)",
] as const;

export const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;
