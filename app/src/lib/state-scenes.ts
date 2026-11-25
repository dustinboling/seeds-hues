/**
 * State-page hero scenes, keyed by state slug — ported verbatim from
 * v2/lib/data/state-scenes.ts (same 16 painterly landscapes, same real
 * pixel sizes, same alt strings). Served copies are
 * /theme/state-scenes/{slug}.webp; width/height are the served files'
 * real pixel sizes, so the browser has the aspect ratio before the file
 * arrives and there is no layout shift.
 */

export type StateScene = { width: number; height: number; alt: string };

export const STATE_SCENES: Record<string, StateScene> = {
  california: { width: 1200, height: 1383, alt: "California landscape with golden poppies" },
  colorado: { width: 1200, height: 892, alt: "Colorado landscape with white and lavender columbine" },
  connecticut: { width: 1200, height: 892, alt: "Connecticut landscape with mountain laurel" },
  georgia: { width: 1200, height: 1402, alt: "Georgia landscape with Cherokee rose" },
  iowa: { width: 1200, height: 774, alt: "Iowa landscape with wild prairie roses" },
  maine: { width: 1200, height: 1838, alt: "Maine landscape with white pine cone and tassel" },
  minnesota: { width: 1200, height: 1340, alt: "Minnesota landscape with pink and white lady's slipper" },
  montana: { width: 1200, height: 664, alt: "Montana landscape with bitterroot" },
  nevada: { width: 1200, height: 1800, alt: "Nevada landscape with sagebrush" },
  "new-york": { width: 1200, height: 962, alt: "New York landscape with roses" },
  oregon: { width: 1200, height: 892, alt: "Oregon landscape with Oregon grape" },
  utah: { width: 1200, height: 1543, alt: "Utah landscape with sego lilies" },
  vermont: { width: 1136, height: 1840, alt: "Vermont landscape with red clover" },
  virginia: { width: 1200, height: 525, alt: "Virginia landscape with American dogwood" },
  washington: { width: 1200, height: 774, alt: "Washington landscape with coast rhododendron" },
  wisconsin: { width: 1200, height: 1300, alt: "Wisconsin landscape with wood violets" },
};
