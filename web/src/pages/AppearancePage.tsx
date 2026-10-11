import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { useTheme, type Theme, type FontSize } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreference, useSetPreference } from '@/hooks/usePreferences'
export function AppearancePage({ hideCompletedItems = false }: { hideCompletedItems?: boolean } = {}) {
  const { t } = useTranslation()
  const { theme, setTheme, fontSize, setFontSize } = useTheme()
  const { language, setLanguage, availableLanguages } = useLanguage()
  const { data: strikethroughPref } = usePreference<boolean>('strikethrough_completed')
  const setPreferenceMutation = useSetPreference()
  const [savedId, setSavedId] = useState<string | null>(null)
  const strikethroughEnabled = strikethroughPref ?? true

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'light', label: t('preferences.themes.light'), description: t('preferences.themes.lightDesc') },
    { value: 'dark', label: t('preferences.themes.dark'), description: t('preferences.themes.darkDesc') },
    { value: 'system', label: t('preferences.themes.system'), description: t('preferences.themes.systemDesc') },
  ]

  const fontSizes: { value: FontSize; label: string; description: string; previewSize: string }[] = [
    { value: 'small', label: t('preferences.fontSizes.smaller'), description: t('preferences.fontSizes.smallerDesc'), previewSize: '12.6px' },
    { value: 'normal', label: t('preferences.fontSizes.normal'), description: t('preferences.fontSizes.normalDesc'), previewSize: '14px' },
    { value: 'large', label: t('preferences.fontSizes.larger'), description: t('preferences.fontSizes.largerDesc'), previewSize: '15.4px' },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground dark:text-foreground mb-6">{t('preferences.appearance')}</h1>

      <div className="space-y-8">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide mb-3">
            {t('preferences.theme')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {themes.map((th) => (
              <button
                key={th.value}
                onClick={() => setTheme(th.value)}
                className={`rounded-lg border p-4 text-start transition-colors ${
                  theme === th.value
                    ? 'border-ring bg-accent dark:bg-accent'
                    : 'border-border dark:border-border bg-surface dark:bg-card hover:border-input dark:hover:border-input'
                }`}
              >
                {th.value === 'system' ? (
                  <div className="mb-3 rounded-md border border-neutral-300 overflow-hidden flex">
                    <div className="w-1/2">
                      <div className="h-3 bg-white border-b border-neutral-200" />
                      <div className="h-12 flex gap-1 p-1.5 bg-neutral-50">
                        <div className="w-6 rounded bg-neutral-200" />
                        <div className="flex-1 space-y-1 pt-0.5">
                          <div className="h-1.5 rounded bg-neutral-300 w-3/4" />
                          <div className="h-1.5 rounded bg-neutral-200 w-1/2" />
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2">
                      <div className="h-3 bg-neutral-900 border-b border-neutral-700" />
                      <div className="h-12 flex gap-1 p-1.5 bg-neutral-900">
                        <div className="w-6 rounded bg-neutral-700" />
                        <div className="flex-1 space-y-1 pt-0.5">
                          <div className="h-1.5 rounded bg-neutral-600 w-3/4" />
                          <div className="h-1.5 rounded bg-neutral-700 w-1/2" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`mb-3 rounded-md border overflow-hidden ${
                    th.value === 'light' ? 'border-neutral-200' : 'border-neutral-700'
                  }`}>
                    <div className={`h-3 ${th.value === 'light' ? 'bg-white border-b border-neutral-200' : 'bg-neutral-900 border-b border-neutral-700'}`} />
                    <div className={`h-12 flex gap-1 p-1.5 ${th.value === 'light' ? 'bg-neutral-50' : 'bg-neutral-900'}`}>
                      <div className={`w-8 rounded ${th.value === 'light' ? 'bg-neutral-200' : 'bg-neutral-700'}`} />
                      <div className="flex-1 space-y-1 pt-0.5">
                        <div className={`h-1.5 rounded ${th.value === 'light' ? 'bg-neutral-300' : 'bg-neutral-600'} w-3/4`} />
                        <div className={`h-1.5 rounded ${th.value === 'light' ? 'bg-neutral-200' : 'bg-neutral-700'} w-1/2`} />
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-sm font-medium text-foreground dark:text-foreground">{th.label}</p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">{th.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide mb-3">
            {t('preferences.fontSize')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {fontSizes.map((fs) => (
              <button
                key={fs.value}
                onClick={() => setFontSize(fs.value)}
                className={`rounded-lg border p-4 text-start transition-colors ${
                  fontSize === fs.value
                    ? 'border-ring bg-accent dark:bg-accent'
                    : 'border-border dark:border-border bg-surface dark:bg-card hover:border-input dark:hover:border-input'
                }`}
              >
                <p className="text-sm font-medium text-foreground dark:text-foreground">{fs.label}</p>
                <p className="text-muted-foreground dark:text-muted-foreground mt-1" style={{ fontSize: fs.previewSize }}>{fs.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide mb-3">
            {t('preferences.language')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {availableLanguages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className={`rounded-lg border p-4 text-start transition-colors ${
                  language === lang.value
                    ? 'border-ring bg-accent dark:bg-accent'
                    : 'border-border dark:border-border bg-surface dark:bg-card hover:border-input dark:hover:border-input'
                }`}
              >
                <p className="text-sm font-medium text-foreground dark:text-foreground">{lang.nativeLabel}</p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">{lang.label}</p>
              </button>
            ))}
          </div>
        </div>

        {!hideCompletedItems && <div>
          <h2 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide mb-3">
            {t('preferences.completedItems')}
          </h2>
          <div className="rounded-lg border border-border dark:border-border px-4 py-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={strikethroughEnabled}
                onChange={() => {
                  setPreferenceMutation.mutate(
                    { key: 'strikethrough_completed', value: !strikethroughEnabled },
                    {
                      onSuccess: () => {
                        setSavedId('strikethrough')
                        setTimeout(() => setSavedId(null), 2000)
                      },
                    },
                  )
                }}
                className="mt-0.5 h-4 w-4 rounded border-border text-foreground focus:ring-ring dark:border-border dark:bg-card"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground dark:text-foreground">
                    {t('preferences.strikethroughCompleted')}
                  </span>
                  {savedId === 'strikethrough' && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                  {t('preferences.strikethroughCompletedDesc')}
                </p>
              </div>
            </label>
          </div>
        </div>}

      </div>
    </div>
  )
}
