import { FileText, Paperclip } from 'lucide-react'
import { api } from '../lib/api'

/**
 * The photographs and reports a patient sent, as the desk and the consultant
 * see them.
 *
 * Thumbnails open in a new tab rather than a lightbox: a doctor wants the
 * image full size next to Klinique, and the browser's own viewer zooms and
 * rotates better than anything worth building here. PDFs get the same
 * treatment through the browser's reader.
 *
 * Nothing is fetched unless somebody is entitled to it — the server checks the
 * session on every one of these requests, so a leaked id is not a leaked file.
 */
export default function AttachmentStrip({ attachments, label = 'Sent by the patient' }) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Paperclip className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {attachments.map((file) => {
          const href = api.attachments.url(file.id)
          return (
            <li key={file.id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={file.name}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-1.5 transition-colors hover:border-brand-400 hover:bg-brand-50"
              >
                {file.kind === 'image' ? (
                  <img
                    src={href}
                    alt={file.name}
                    loading="lazy"
                    className="size-12 rounded object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded bg-slate-100 text-slate-500">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                )}
                <span className="max-w-32 truncate pe-1 text-xs font-medium text-slate-700">
                  {file.name}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
