/** Whether a name refers to an existing master: exact match after trimming, as the backend decides. */
export const masterStatus = (
  name: string,
  masters: readonly { name: string }[],
): 'existing' | 'new' | null => {
  const trimmed = name.trim()
  if (!trimmed) return null
  return masters.some((m) => m.name === trimmed) ? 'existing' : 'new'
}

// Legal-entity abbreviations and their full forms (after NFKC, so （株） has become (株)).
const ENTITY_FORMS: [RegExp, string][] = [
  [/\(株\)|㈱/g, '株式会社'],
  [/\(有\)|㈲/g, '有限会社'],
  [/\(同\)/g, '合同会社'],
  [/\(一社\)/g, '一般社団法人'],
  [/\(一財\)/g, '一般財団法人'],
]

/**
 * The comparison key for spotting spelling variants: width and case folded, legal-entity
 * abbreviations expanded, spaces and separators dropped. 「技術本部 / IoT推進室」 and
 * 「技術本部IoT推進室」 share a key, as do 「東都電機(株)」 and 「東都電機株式会社」.
 */
export const variantKey = (name: string) => {
  let key = name.normalize('NFKC').toLowerCase()
  for (const [pattern, full] of ENTITY_FORMS) key = key.replace(pattern, full)
  return key.replace(/[\s/・.,、。|()「」[\]-]/g, '')
}

/** Groups of two or more masters that look like spelling variants of each other. */
export const findVariantGroups = <T extends { name: string }>(masters: readonly T[]): T[][] => {
  const groups = new Map<string, T[]>()
  for (const master of masters) {
    const key = variantKey(master.name)
    groups.set(key, [...(groups.get(key) ?? []), master])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}
