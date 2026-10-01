/**
 * App-wide limits and tunable values: every cap, size, duration and count the app enforces or
 * depends on, in one place. Single source of truth for the `docs/spec.md` "参照 > リミット値" table —
 * one entry per table row, referenced there as `LIMITS.<name>`. Values may change during
 * development or operation: change them here only, and update the spec table in the same change.
 *
 * Imported by both `apps/frontend` (to validate and show the limit in the UI) and `apps/backend`
 * (to enforce it in the API), so the two can never disagree.
 *
 * Conventions for each entry:
 * - Name it after what it limits, with the unit as a suffix: `...Bytes`, `...Px`, `...Days`,
 *   `...Minutes`, `...MaxLength` (characters, counted with `charLength`), a plain noun for a count.
 * - Write the value in its readable form (`300 * 1024 * 1024`, not `314572800`).
 * - JSDoc: what it limits, the unit, where it's checked (UI / API / both), and "Provisional." if
 *   the spec marks it 暫定値.
 */
export const LIMITS = {
  /** Max length (characters) of every text value on a card, profile or master. Checked in the API; the memo also in the UI. */
  textMaxLength: 1000,
  /** Max number of values in each multi-value field of a card (titles, emails, departments, ...). Checked in the API. */
  valuesPerField: 50,
  /** Max number of offices on a card. Checked in the API. */
  officesPerCard: 20,
  /** Max number of affiliations on a user's profile. Checked in the API. */
  affiliationsPerUser: 20,
  /** Max number of cards a user can register. Checked in the API, and in the UI before taking photos. */
  cardsPerUser: 300,
  /** Max number of masters merged into another in one request. Checked in the API. */
  mergeSourcesPerRequest: 100,
  /** Max size of a request body, in bytes (10 MB). Checked in the API before the body is read. */
  requestBodyBytes: 10 * 1024 * 1024,
  /** Max size of a card photo, in bytes (5 MB). Checked in the API on upload. */
  imageBytes: 5 * 1024 * 1024,
  /** Long edge a card photo is shrunk to before upload, in pixels. Applied in the UI. */
  imageLongEdgePx: 1280,
  /** How long an unused card photo is kept before the daily cleanup deletes it, in hours. */
  orphanImageKeepHours: 24,
  /** Pause in typing before the card list searches, in milliseconds. */
  searchDebounceMs: 500,
  /** How long a sign-in lasts before Google sign-in is needed again, in hours. Set by the API. */
  sessionHours: 12,
  /** Timeout of an API request from the UI, in milliseconds. */
  requestTimeoutMs: 3 * 1000,
  /** Timeout of a slow API request from the UI (photo upload, AI extraction, CSV export), in milliseconds. */
  longRequestTimeoutMs: 60 * 1000,
} as const
