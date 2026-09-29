const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

/**
 * Shrinks a photo to at most 1600px on its long edge, as JPEG. A phone photo is several MB; this
 * brings it well under the API's 5MB limit and keeps upload and AI extraction fast, while still
 * leaving small print on a business card legible.
 */
export const resizeImage = async (source: Blob, name: string): Promise<File> => {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
  return new File([blob], name, { type: 'image/jpeg' })
}
