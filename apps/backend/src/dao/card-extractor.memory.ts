import type { CardExtractorDao } from './card-extractor.interface.ts'

/** Stand-in for the vision model: replies with `reply` whatever the image, so the app runs without an AI binding. */
export const createCardExtractorDao = (reply = '{}'): CardExtractorDao => ({
  extract: async () => reply,
})
