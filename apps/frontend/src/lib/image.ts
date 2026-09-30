const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      quality,
    ),
  )

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
  return new File([await toJpeg(canvas, JPEG_QUALITY)], name, { type: 'image/jpeg' })
}

/** Turns a photo 90° clockwise, for a card shot at the wrong angle. Full size, so it can be resized later. */
export const rotateImage = async (source: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.height
  canvas.height = bitmap.width
  const context = canvas.getContext('2d')
  context?.translate(canvas.width, 0)
  context?.rotate(Math.PI / 2)
  context?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return toJpeg(canvas, 0.92)
}
