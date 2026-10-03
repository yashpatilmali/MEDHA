/**
 * Where to place the patch, from the patient's usual position: on the area that position puts the
 * most pressure on. Keys match the backend.
 */
export const PATCH_POSITIONS = [
  {
    value: 'sitting',
    label: 'Wheelchair / prolonged sitting',
    site: 'Bottom (seat area)',
    instruction: "Place the patch on the patient's bottom, where they sit.",
  },
  {
    value: 'back',
    label: 'Lying mostly on the back',
    site: 'Lower back / bottom',
    instruction: "Place the patch on the patient's lower back / bottom area.",
  },
  {
    value: 'right_side',
    label: 'Lying mostly on the right side',
    site: 'Right hip',
    instruction: "Place the patch on the patient's right hip.",
  },
  {
    value: 'left_side',
    label: 'Lying mostly on the left side',
    site: 'Left hip',
    instruction: "Place the patch on the patient's left hip.",
  },
] as const;

export type PatchPosition = (typeof PATCH_POSITIONS)[number]['value'];
