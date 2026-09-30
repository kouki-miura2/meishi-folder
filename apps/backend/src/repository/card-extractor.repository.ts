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
  "name": person's full name as printed (string or null). Usually the largest text on the card; a Japanese name is typically 2 to 6 kanji,
  "nameKana": reading of the name in katakana, only if printed (string or null). Often printed in small letters near the name. If the reading is in Latin letters, put it in nameRomaji instead,
  "nameRomaji": name in Latin letters, only if printed (string or null). Often printed in small letters near the name,
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

/** Never fails on a bad reply: the user corrects the result before saving, so an empty field beats an error. */
export const toExtractedCard = (reply: string): ExtractedCard => {
  const fields = parseReply(reply)
  return {
    name: text(fields.name),
    nameKana: text(fields.nameKana),
    nameRomaji: text(fields.nameRomaji),
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
