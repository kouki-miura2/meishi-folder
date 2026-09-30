import type { CardExtractorDao } from '../dao/card-extractor.interface.ts'
import type { CardImage } from './card-image.repository.ts'
import type { Office } from './card.repository.ts'

/** The printed items of a card, as far as the model could read them. Anything unreadable is null / empty. */
export interface ExtractedCard {
  name: string | null
  nameKana: string | null
  nameRomaji: string | null
  companyName: string | null
  departmentNames: string[]
  titles: string[]
  jobTypes: string[]
  mobile: string | null
  emails: string[]
  otherContacts: string[]
  url: string | null
  offices: Office[]
}

export interface CardExtractorRepository {
  extract: (image: CardImage) => Promise<ExtractedCard>
}

export const EXTRACTION_PROMPT = `This image is a business card. Read every item printed on it and reply with only one JSON object, no other text, using exactly these keys:
{
  "familyName": family name (surname) in Japanese characters (kanji, hiragana or katakana), without any spaces (string or null). See the name rules below,
  "givenName": given name in Japanese characters, without any spaces (string or null). See the name rules below,
  "familyNameKana": reading of the family name in katakana, without any spaces, only if printed (string or null),
  "givenNameKana": reading of the given name in katakana, without any spaces, only if printed (string or null),
  "nameRomaji": name in Latin letters exactly as printed, only if printed (string or null), e.g. "Taro Yamada". Often printed in small letters near the name or on the back of the card,
  "companyName": company or organization name (string or null). Often in the form "〇〇株式会社" or "株式会社〇〇"; it may also be a hospital or an association,
  "departmentNames": departments / divisions (array of strings),
  "titles": job titles or positions (array of strings),
  "jobTypes": professions or qualifications (array of strings),
  "mobile": mobile phone number (string or null). A 11 digit number starting with 070, 080 or 090, sometimes with a hyphen every 3 or 4 digits,
  "emails": email addresses (array of strings),
  "otherContacts": other contacts such as SNS accounts (array of strings),
  "url": website URL (string or null),
  "offices": [{ "postalCode": string or null, "address": string or null, "tel": string or null, "fax": string or null }]
}
Name rules:
1. Use exactly the characters printed. Never translate or romanize. The name is usually the largest text on the card, typically 2 to 6 kanji: the family name first, then the given name.
2. Names are often printed with wide letter spacing, such as "山 田　太 郎". Split the name into the family name and the given name, and drop the spaces: "familyName": "山田", "givenName": "太郎". Readings the same way: "ヤ マ ダ　タ ロ ウ" -> "familyNameKana": "ヤマダ", "givenNameKana": "タロウ".
3. If you can't tell where the family name ends, put the whole name, without spaces, in "familyName" and use null for "givenName".
4. If the name is printed only in Latin letters, the Japanese name keys are null and the Latin name goes in "nameRomaji". A reading in Latin letters also goes in "nameRomaji".

Use null or [] for anything not printed. Do not guess.`

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const texts = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map(text).filter((v): v is string => v !== null)

const office = (value: unknown): Office => {
  const fields = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  return {
    postalCode: text(fields.postalCode),
    address: text(fields.address),
    tel: text(fields.tel),
    fax: text(fields.fax),
  }
}

/** Pulls the first JSON object out of the reply; models often wrap it in prose or code fences. */
const parseReply = (reply: string): Record<string, unknown> => {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end < start) return {}
  try {
    const parsed: unknown = JSON.parse(reply.slice(start, end + 1))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * The model answers the family and given names separately, which makes it decide where one ends
 * and drop the letter spacing cards often print names with ("山 田 太 郎"). Joined with one
 * full-width space (U+3000), as Japanese names are written; a missing part is left out.
 */
const joinName = (family: unknown, given: unknown): string | null =>
  [text(family), text(given)].filter((part) => part !== null).join('　') || null

const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

/**
 * The model often puts a romanized name in `name` even when asked not to. A name without a single
 * kanji or kana goes to `nameRomaji` instead, so `name` only ever holds the name as printed in
 * Japanese — and, left empty, lets the other side of the card supply it.
 */
const splitName = (name: string | null, nameRomaji: string | null) =>
  name && !japanese.test(name)
    ? { name: null, nameRomaji: nameRomaji ?? name }
    : { name, nameRomaji }

/** Never fails on a bad reply: the user corrects the result before saving, so an empty field beats an error. */
export const toExtractedCard = (reply: string): ExtractedCard => {
  const fields = parseReply(reply)
  return {
    ...splitName(
      joinName(fields.familyName, fields.givenName) ?? text(fields.name),
      text(fields.nameRomaji),
    ),
    nameKana: joinName(fields.familyNameKana, fields.givenNameKana) ?? text(fields.nameKana),
    companyName: text(fields.companyName),
    departmentNames: texts(fields.departmentNames),
    titles: texts(fields.titles),
    jobTypes: texts(fields.jobTypes),
    mobile: text(fields.mobile),
    emails: texts(fields.emails),
    otherContacts: texts(fields.otherContacts),
    url: text(fields.url),
    offices: (Array.isArray(fields.offices) ? fields.offices : [])
      .map(office)
      .filter((o) => Object.values(o).some((v) => v !== null)),
  }
}

export const createCardExtractorRepository = (dao: CardExtractorDao): CardExtractorRepository => ({
  extract: async (image) =>
    toExtractedCard(
      await dao.extract({ body: image.body, content_type: image.contentType }, EXTRACTION_PROMPT),
    ),
})
