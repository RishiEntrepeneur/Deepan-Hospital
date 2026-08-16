import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { canSpeak, isSpeaking, onSpeechChange, stopSpeaking, toggleSpeech } from '../lib/speech'
import { cx } from '../lib/cx'

/**
 * "Read this to me."
 *
 * Attached to a specific passage rather than the page, so what is spoken is
 * what the patient was looking at. It reads in whichever language the app is
 * set to, because the text it is given is already in that language.
 *
 * Only one of these can be speaking at a time — they all subscribe to the same
 * speech module, so pressing a second stops the first and both icons update.
 *
 * Hidden entirely on a device that cannot speak the current language. A button
 * that does nothing when pressed is worse than an absent one, and the common
 * case is a phone with no Tamil voice installed and no server key configured.
 */
export default function SpeakButton({ text, label, className, size = 'md' }) {
  const { t, lang } = useLanguage()
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => onSpeechChange(setSpeaking), [])

  /*
   * Stop when the passage or the language changes. Otherwise switching to
   * Tamil mid-sentence leaves an English voice reading text no longer on
   * screen, and navigating away leaves the page talking to nobody.
   */
  useEffect(() => {
    return () => {
      if (isSpeaking()) stopSpeaking()
    }
  }, [text, lang])

  if (!text || !canSpeak(lang)) return null

  const press = async () => {
    setFailed(false)
    const started = await toggleSpeech(text, lang)
    // `false` from a stop is expected; only a failure to start is worth saying.
    if (!started && !speaking) setFailed(true)
  }

  const box = size === 'sm' ? 'size-8' : 'size-9'
  const icon = size === 'sm' ? 'size-3.5' : 'size-4'

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={press}
        aria-label={speaking ? t('speech.stop') : (label ?? t('speech.listen'))}
        title={speaking ? t('speech.stop') : (label ?? t('speech.listen'))}
        aria-pressed={speaking}
        className={cx(
          'inline-grid shrink-0 place-items-center rounded-full border transition',
          box,
          speaking
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
          className,
        )}
      >
        {speaking ? (
          <VolumeX className={cx(icon, 'animate-pulse')} aria-hidden="true" />
        ) : (
          <Volume2 className={icon} aria-hidden="true" />
        )}
      </button>
      {failed && <span className="text-xs text-slate-500">{t('speech.unavailable')}</span>}
    </span>
  )
}
