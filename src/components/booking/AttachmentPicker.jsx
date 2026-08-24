import { useRef, useState } from 'react'
import { FileText, ImageUp, LoaderCircle, Paperclip, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useLanguage } from '../../i18n/context'
import { shrinkImage } from '../../lib/shrinkImage'

const MAX_FILES = 4
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

/**
 * Where a patient adds a photograph or a report to their booking.
 *
 * Each file is uploaded the moment it is chosen rather than held until the form
 * is submitted: an 8 MB photograph on a waiting-room connection takes long
 * enough that doing it at submit time would look like the booking had hung.
 * By the time the patient reaches the last step the files are already on the
 * server, and the booking sends only their ids.
 *
 * Every accepted file is reported upward through `onChange` as
 * `{ id, token, name, kind }`. The token is what the booking uses to claim the
 * file, and it never leaves this browser otherwise.
 */
export default function AttachmentPicker({ files, onChange }) {
  const { t } = useLanguage()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState(null)

  const room = MAX_FILES - files.length

  const add = async (chosen) => {
    setError(null)
    const list = [...chosen].slice(0, room)
    if (list.length === 0) return

    setBusy((n) => n + list.length)
    for (const raw of list) {
      try {
        const file = await shrinkImage(raw)
        const saved = await api.attachments.upload(file)
        // A local preview costs nothing and shows the patient what they sent.
        const preview = file.type === 'application/pdf' ? null : URL.createObjectURL(file)
        onChange((current) => [...current, { ...saved, preview }])
      } catch (err) {
        setError(err.message || t('attach.failed'))
      } finally {
        setBusy((n) => n - 1)
      }
    }
    // Let the same file be picked again after a removal.
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (id) => {
    onChange((current) => {
      const gone = current.find((f) => f.id === id)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return current.filter((f) => f.id !== id)
    })
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{t('attach.label')}</p>
      <p className="mt-0.5 text-xs text-slate-500">{t('attach.hint')}</p>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="relative flex items-center gap-2 rounded-lg border border-slate-300 bg-white py-1.5 pe-8 ps-2"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt=""
                  className="size-9 rounded object-cover"
                />
              ) : (
                <span className="grid size-9 place-items-center rounded bg-slate-100 text-slate-500">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
              )}
              <span className="max-w-36 truncate text-xs font-medium text-slate-700">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => remove(file.id)}
                aria-label={t('attach.remove', { name: file.name })}
                className="absolute end-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={room <= 0 || busy > 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy > 0 ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : files.length === 0 ? (
            <ImageUp className="size-4" aria-hidden="true" />
          ) : (
            <Paperclip className="size-4" aria-hidden="true" />
          )}
          {busy > 0 ? t('attach.sending') : t('attach.add')}
        </button>
        {room > 0 ? (
          <span className="text-xs text-slate-500">{t('attach.remaining', { n: room })}</span>
        ) : (
          <span className="text-xs text-slate-500">{t('attach.full')}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => add(event.target.files)}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
