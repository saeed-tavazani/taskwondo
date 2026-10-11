import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface CopyButtonProps {
  text: string
  className?: string
  tooltip?: string
}

export function CopyButton({ text, className = '', tooltip }: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <button
      type="button"
      className={`group/copy relative inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted transition-colors ${className}`}
      onClick={handleCopy}
      aria-label={tooltip ?? t('common.copyToClipboard')}
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5l3 3 6-7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
          <rect x="5.5" y="5.5" width="7" height="9" rx="1.5" />
          <path d="M3.5 11.5v-8a1.5 1.5 0 011.5-1.5h5" />
        </svg>
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-inverse-foreground bg-inverse dark:bg-inverse rounded whitespace-nowrap opacity-0 group-hover/copy:opacity-100 transition-opacity">
        {copied ? t('common.copied') : (tooltip ?? t('common.copyToClipboard'))}
      </span>
    </button>
  )
}
