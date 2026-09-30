import type { CardExtractorDao } from 'backend/src/dao/card-extractor.interface.ts'

// Before the first call, the account must accept Meta's license once by running this model
// with the prompt "agree" (see docs/spec.md, 各論 > AI 抽出).
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'

export const createCardExtractorDao = (ai: Ai): CardExtractorDao => ({
  extract: async (image, prompt) => {
    const result = await ai.run(MODEL, {
      prompt,
      image: [...new Uint8Array(image.body)],
      max_tokens: 1024,
      temperature: 0,
    })
    // Typed as a string, but Workers AI parses a reply that is pure JSON and hands back the object.
    const response: unknown = result.response
    if (response === undefined || response === null) return ''
    return typeof response === 'string' ? response : JSON.stringify(response)
  },
})
