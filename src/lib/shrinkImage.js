/**
 * Shrink a photograph in the browser, before it is ever uploaded.
 *
 * A phone camera produces 4000-pixel, 6 MB images. A consultant looking at a
 * rash on a desk monitor needs nothing like that, and the patient is very often
 * on mobile data in a waiting room — so the resize happens here, where a slow
 * connection is not yet involved. A 6 MB photo typically leaves as 300 KB.
 *
 * PDFs are passed through untouched: a report is text and re-encoding it would
 * either corrupt it or make it larger.
 */

const MAX_EDGE = 1600
const QUALITY = 0.82

/** True for the image types the server accepts and a canvas can re-encode. */
const SHRINKABLE = ['image/jpeg', 'image/png', 'image/webp']

export async function shrinkImage(file) {
  if (!SHRINKABLE.includes(file.type)) return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // An image the browser cannot decode is not one we should re-encode; let
    // the server judge it instead of failing the whole booking here.
    return file
  }

  const { width, height } = bitmap
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))

  // Already small enough, and already a compressed format: leave it alone.
  if (scale === 1 && file.type !== 'image/png') {
    bitmap.close?.()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close?.()
    return file
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) return file

  // If re-encoding somehow made it bigger, keep the original.
  if (blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
}
