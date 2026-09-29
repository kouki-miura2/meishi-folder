import type {
  CardInput,
  CardUpdateInput,
  CardView,
  ExtractedCard,
  Visibility,
} from '../api/types.ts'

export interface OfficeForm {
  postalCode: string
  address: string
  tel: string
  fax: string
}

/** A card as the edit screens hold it: every text field a string ('' = empty), every list an array. */
export interface CardForm {
  name: string
  nameKana: string
  nameRomaji: string
  companyName: string
  departmentNames: string[]
  titles: string[]
  jobTypes: string[]
  mobile: string
  emails: string[]
  otherContacts: string[]
  url: string
  offices: OfficeForm[]
  metOn: string
  metAt: string
  metOccasion: string
  handleName: string
  projectNames: string[]
  groupNames: string[]
  visibility: Visibility
}

export const emptyOffice = (): OfficeForm => ({ postalCode: '', address: '', tel: '', fax: '' })

export const emptyCardForm = (): CardForm => ({
  name: '',
  nameKana: '',
  nameRomaji: '',
  companyName: '',
  departmentNames: [],
  titles: [],
  jobTypes: [],
  mobile: '',
  emails: [],
  otherContacts: [],
  url: '',
  offices: [],
  metOn: '',
  metAt: '',
  metOccasion: '',
  handleName: '',
  projectNames: [],
  groupNames: [],
  visibility: 'private',
})

const office = (o: { [K in keyof OfficeForm]: string | null }): OfficeForm => ({
  postalCode: o.postalCode ?? '',
  address: o.address ?? '',
  tel: o.tel ?? '',
  fax: o.fax ?? '',
})

export const formFromCard = (card: CardView): CardForm => ({
  name: card.name ?? '',
  nameKana: card.nameKana ?? '',
  nameRomaji: card.nameRomaji ?? '',
  companyName: card.company?.name ?? '',
  departmentNames: card.departments.map((d) => d.name),
  titles: [...card.titles],
  jobTypes: [...card.jobTypes],
  mobile: card.mobile ?? '',
  emails: [...card.emails],
  otherContacts: [...card.otherContacts],
  url: card.url ?? '',
  offices: card.offices.map(office),
  metOn: card.metOn ?? '',
  metAt: card.metAt ?? '',
  metOccasion: card.metOccasion ?? '',
  handleName: card.handleName ?? '',
  projectNames: card.projects.map((p) => p.name),
  groupNames: card.groups.map((g) => g.name),
  visibility: card.visibility,
})

/** A freshly read card: its printed items, with the date it was received defaulting to today. */
export const formFromExtracted = (extracted: ExtractedCard, today: string): CardForm => ({
  ...emptyCardForm(),
  name: extracted.name ?? '',
  nameKana: extracted.nameKana ?? '',
  nameRomaji: extracted.nameRomaji ?? '',
  companyName: extracted.companyName ?? '',
  departmentNames: [...extracted.departmentNames],
  titles: [...extracted.titles],
  jobTypes: [...extracted.jobTypes],
  mobile: extracted.mobile ?? '',
  emails: [...extracted.emails],
  otherContacts: [...extracted.otherContacts],
  url: extracted.url ?? '',
  offices: extracted.offices.map(office),
  metOn: today,
})

const text = (value: string) => value.trim() || null
const texts = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)

/** The items printed on the card: what a new scan replaces when overwriting a registered card. */
const printedInput = (form: CardForm) => ({
  name: text(form.name),
  nameKana: text(form.nameKana),
  nameRomaji: text(form.nameRomaji),
  companyName: text(form.companyName),
  departmentNames: texts(form.departmentNames),
  titles: texts(form.titles),
  jobTypes: texts(form.jobTypes),
  mobile: text(form.mobile),
  emails: texts(form.emails),
  otherContacts: texts(form.otherContacts),
  url: text(form.url),
  offices: form.offices
    .map((o) => ({
      postalCode: text(o.postalCode),
      address: text(o.address),
      tel: text(o.tel),
      fax: text(o.fax),
    }))
    .filter((o) => Object.values(o).some((v) => v !== null)),
})

export interface CardImages {
  frontImageId: string | null
  backImageId: string | null
}

/** A new card. New cards are always private (the backend enforces it too). */
export const toCreateInput = (form: CardForm, images: CardImages): CardInput => ({
  ...printedInput(form),
  metOn: text(form.metOn),
  metAt: text(form.metAt),
  metOccasion: text(form.metOccasion),
  handleName: text(form.handleName),
  projectNames: texts(form.projectNames),
  groupNames: texts(form.groupNames),
  ...images,
})

/** Edits from the detail screen: every field, photos untouched. */
export const toUpdateInput = (form: CardForm): CardUpdateInput => {
  const {
    frontImageId: _front,
    backImageId: _back,
    ...input
  } = toCreateInput(form, {
    frontImageId: null,
    backImageId: null,
  })
  return { ...input, visibility: form.visibility }
}

/** Overwriting a registered card with a new scan: photos and printed items only; scene and notes stay. */
export const toOverwriteInput = (form: CardForm, images: CardImages): CardUpdateInput => ({
  ...printedInput(form),
  ...images,
})

/** Problems that block saving, as messages for the user. */
export const validateCardForm = (form: CardForm): string[] => {
  const errors: string[] = []
  if (!text(form.name) && !text(form.nameKana) && !text(form.handleName)) {
    errors.push('氏名・氏名カナ・ハンドルネームのいずれかを入力してください')
  }
  if (!text(form.companyName) && texts(form.departmentNames).length > 0) {
    errors.push('所属を入力するときは会社・団体名も入力してください')
  }
  if (text(form.metOn) && !/^\d{4}-\d{2}-\d{2}$/.test(form.metOn.trim())) {
    errors.push('取得日は YYYY-MM-DD の形式で入力してください')
  }
  return errors
}

export type ReviewField = 'name' | 'nameKana' | 'mobile' | 'emails' | 'url' | 'offices'

const KATAKANA = /^[゠-ヿ\s　・ー]+$/
const PHONE_CHARS = /^\+?[\d\s()-]+$/
/**
 * Only phone characters, and as many digits as the number needs: in Japan 11 for mobile / IP
 * numbers (050, 070, 080, 090) and 10 for the rest; 8–15 in +international form.
 */
const isPhone = (value: string) => {
  if (!PHONE_CHARS.test(value)) return false
  const digits = value.replace(/\D/g, '')
  if (value.startsWith('+')) return digits.length >= 8 && digits.length <= 15
  return digits.length === (/^0[5789]0/.test(digits) ? 11 : 10)
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_LIKE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i
const POSTAL_CODE = /^\d{3}-?\d{4}$/

/**
 * Fields worth a second look after AI extraction ("要確認"). The model reports no confidence, so
 * this checks the shape of what it read: a misread character usually breaks the format.
 */
export const fieldsToReview = (form: CardForm): Set<ReviewField> => {
  const review = new Set<ReviewField>()
  if (!text(form.name)) review.add('name')
  if (text(form.nameKana) && !KATAKANA.test(form.nameKana.trim())) review.add('nameKana')
  if (text(form.mobile) && !isPhone(form.mobile.trim())) review.add('mobile')
  if (texts(form.emails).some((e) => !EMAIL.test(e))) review.add('emails')
  if (text(form.url) && !URL_LIKE.test(form.url.trim())) review.add('url')
  const badOffice = (o: OfficeForm) =>
    (text(o.postalCode) && !POSTAL_CODE.test(o.postalCode.trim())) ||
    [o.tel, o.fax].some((n) => text(n) && !isPhone(n.trim()))
  if (form.offices.some(badOffice)) review.add('offices')
  return review
}
