import type { Exercise } from "./types";

/**
 * Movement families used by the "swap exercise" menu in the workout editor.
 * Exercises are user-created, so similarity is guessed from the name: two
 * exercises in the same family (e.g. "DB Bench Press" and "Weighted Dips")
 * are offered first, then the rest of the same muscle group.
 *
 * Order matters: the first family whose pattern matches wins, so the more
 * specific patterns come first (triceps before presses, so "Overhead
 * Tricep Extension" counts as triceps).
 */
const FAMILIES: { key: string; label: string; pattern: RegExp }[] = [
  {
    key: "vertical-pull",
    label: "Pull-ups & pulldowns",
    pattern: /pull[\s-]?ups?|chin[\s-]?ups?|pull[\s-]?downs?|\blat\b|lats\b/,
  },
  {
    key: "triceps",
    label: "Triceps",
    pattern: /tricep|skull|push[\s-]?down|close[\s-]?grip\s?(bench|press)|french/,
  },
  { key: "row", label: "Rows", pattern: /\brows?\b|rowing/ },
  {
    key: "raise",
    label: "Raises",
    pattern: /lateral|front\s?raise|rear\s?delt|reverse\s?fly|face\s?pull|y[\s-]?raise/,
  },
  {
    key: "fly",
    label: "Flyes",
    pattern: /\bfl(y|ys|ies|yes)\b|pec\s?deck|crossover/,
  },
  {
    key: "chest-press",
    label: "Presses",
    pattern: /bench|chest\s?press|\bdips?\b|push[\s-]?ups?|floor\s?press|(incline|decline).*press/,
  },
  {
    key: "overhead-press",
    label: "Overhead presses",
    pattern: /overhead|shoulder\s?press|military|\bohp\b|arnold|push\s?press/,
  },
  {
    key: "hinge",
    label: "Deadlifts & hinges",
    pattern: /deadlift|\brdl\b|romanian|good\s?morning|hip\s?hinge|hyperextension|back\s?extension/,
  },
  {
    key: "hip-thrust",
    label: "Hip thrusts & bridges",
    pattern: /hip\s?thrust|glute\s?bridge|bridge|kickback|abduct/,
  },
  {
    key: "squat",
    label: "Squats & lunges",
    pattern: /squat|leg\s?press|lunge|split|step[\s-]?up|hack|belt/,
  },
  { key: "leg-curl", label: "Leg curls", pattern: /leg\s?curl|hamstring\s?curl|nordic/ },
  { key: "leg-ext", label: "Leg extensions", pattern: /leg\s?ext|extension.*quad|sissy/ },
  { key: "calf", label: "Calf raises", pattern: /calf|calves/ },
  { key: "curl", label: "Curls", pattern: /curl|bicep/ },
  { key: "shrug", label: "Shrugs", pattern: /shrug/ },
  {
    key: "core",
    label: "Core",
    pattern: /plank|crunch|sit[\s-]?up|leg\s?raise|\babs?\b|rollout|wood\s?chop|pallof|hollow/,
  },
  { key: "carry", label: "Carries", pattern: /carry|farmer|suitcase/ },
];

function familyOf(name: string): (typeof FAMILIES)[number] | undefined {
  const n = name.toLowerCase();
  return FAMILIES.find((f) => f.pattern.test(n));
}

export interface SwapOptions {
  /** Label for the "closest matches" group, e.g. "Similar presses". */
  similarLabel: string;
  similar: Exercise[];
  sameGroup: Exercise[];
  others: Exercise[];
}

/**
 * Split the library into swap candidates for `current`: same movement family
 * first, then the rest of the same muscle group, then everything else (only
 * shown when searching). Archived exercises and `current` are left out.
 */
export function swapOptionsFor(current: Exercise, all: Exercise[]): SwapOptions {
  const fam = familyOf(current.name);
  const similar: Exercise[] = [];
  const sameGroup: Exercise[] = [];
  const others: Exercise[] = [];
  for (const e of all) {
    if (e.archived || e.id === current.id) continue;
    if (fam && familyOf(e.name)?.key === fam.key) similar.push(e);
    else if (e.muscleGroup === current.muscleGroup) sameGroup.push(e);
    else others.push(e);
  }
  const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name);
  similar.sort(byName);
  sameGroup.sort(byName);
  others.sort(byName);
  return {
    similarLabel: fam ? `Similar: ${fam.label.toLowerCase()}` : "Similar",
    similar,
    sameGroup,
    others,
  };
}
