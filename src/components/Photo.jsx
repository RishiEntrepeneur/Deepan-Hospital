import { useState } from 'react'
import { cx } from '../lib/cx'

/**
 * A photograph that vanishes cleanly when the file isn't there.
 *
 * Every image in this app is optional: the hospital drops real photographs
 * into `public/` and they appear. Nothing ships with stock imagery, because a
 * photo of somebody else's hospital misrepresents this one — and because the
 * layouts are designed to look finished without any photography at all.
 */
export default function Photo({ src, alt = '', className, imgClassName, children, ...rest }) {
  const [failed, setFailed] = useState(false)

  // No file: render the fallback if one was given, otherwise nothing at all.
  if (failed) return children ?? null

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cx('object-cover', className, imgClassName)}
      {...rest}
    />
  )
}
