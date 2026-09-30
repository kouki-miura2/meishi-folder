/** Hands `blob` to the browser as a file download named `filename`. */
export const saveFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Some browsers read the URL only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
