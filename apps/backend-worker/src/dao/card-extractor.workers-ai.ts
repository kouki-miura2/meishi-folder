import type { CardExtractorDao } from 'backend/src/dao/card-extractor.interface.ts'

// Before the first call, the account must accept Meta's license once by running this model
// with the prompt "agree" (see docs/implementation-plan.md, phase 0).
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'

export const createCardExtractorDao = (ai: Ai): CardExtractorDao => ({
  extract: async (image, prompt) => {
    const result = await ai.run(MODEL, {
      prompt,
      image: [...new Uint8Array(image.body)],
      max_tokens: 1024,
      temperature: 0,
    })
    return result.response ?? ''
  },
})
