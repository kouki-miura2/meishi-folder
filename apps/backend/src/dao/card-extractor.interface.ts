import type { CardImageObject } from './card-image.interface.ts'

/** Runs a vision model over one card photo. The prompt and the parsing of the reply live in the repository. */
export interface CardExtractorDao {
  /** Resolves the model's raw text reply. */
  extract: (image: CardImageObject, prompt: string) => Promise<string>
}
