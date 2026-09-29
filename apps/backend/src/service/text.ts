/** Trims a user-entered value; blank becomes `null`. */
export const cleanText = (value: string | null | undefined): string | null => value?.trim() || null

/** Trims each value, dropping blanks and duplicates while keeping the original order. */
export const cleanTexts = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
]
