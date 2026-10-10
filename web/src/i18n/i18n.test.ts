import { describe, it, expect } from 'vitest'
import en from './en.json'
import fa from './fa.json'

const translations: Record<string, Record<string, string>> = {
  fa,
}

const enKeys = Object.keys(en).sort()

// Persian intentionally keeps brand names, example addresses, identifiers, and format-only values.
const SAME_VALUE_ALLOWED_BY_LANGUAGE: Record<string, Set<string>> = {
  fa: new Set([
    'admin.authentication.discord.title',
    'admin.authentication.github.title',
    'admin.authentication.google.title',
    'admin.authentication.microsoft.title',
    'admin.integrations.smtp.fromAddressPlaceholder',
    'admin.integrations.smtp.fromNamePlaceholder',
    'admin.integrations.smtp.imapHostPlaceholder',
    'admin.integrations.smtp.smtpHostPlaceholder',
    'admin.integrations.smtp.usernamePlaceholder',
    'brand.name',
    'namespaces.emailInvitePlaceholder',
    'namespaces.limitCounter',
    'projects.create.keyPlaceholder',
    'projects.limitCounter',
    'sla.columnHeader',
  ]),
}

describe('i18n completeness', () => {
  for (const [lang, data] of Object.entries(translations)) {
    describe(lang, () => {
      it('has no missing keys', () => {
        const langKeys = new Set(Object.keys(data))
        const missing = enKeys.filter((k) => !langKeys.has(k))
        expect(missing, `Missing keys in ${lang}`).toEqual([])
      })

      it('has no extra keys', () => {
        const enKeySet = new Set(enKeys)
        const extra = Object.keys(data).filter((k) => !enKeySet.has(k))
        expect(extra, `Extra keys in ${lang}`).toEqual([])
      })

      it('preserves interpolation placeholders', () => {
        const placeholderRe = /\{\{(\w+)\}\}/g
        const mismatched: string[] = []

        for (const key of enKeys) {
          if (!(key in data)) continue
          const enPlaceholders = [...(en as Record<string, string>)[key].matchAll(placeholderRe)]
            .map((m) => m[1])
            .sort()
          const langPlaceholders = [...data[key].matchAll(placeholderRe)]
            .map((m) => m[1])
            .sort()

          if (JSON.stringify(enPlaceholders) !== JSON.stringify(langPlaceholders)) {
            mismatched.push(
              `${key}: expected {{${enPlaceholders.join(', ')}}} but got {{${langPlaceholders.join(', ')}}}`
            )
          }
        }

        expect(mismatched, `Placeholder mismatches in ${lang}`).toEqual([])
      })

      it('preserves HTML-like tags for Trans component', () => {
        const tagRe = /<(\w+)>/g
        const mismatched: string[] = []

        for (const key of enKeys) {
          if (!(key in data)) continue
          const enTags = [...(en as Record<string, string>)[key].matchAll(tagRe)]
            .map((m) => m[1])
            .sort()
          const langTags = [...data[key].matchAll(tagRe)]
            .map((m) => m[1])
            .sort()

          if (JSON.stringify(enTags) !== JSON.stringify(langTags)) {
            mismatched.push(
              `${key}: expected <${enTags.join(', ')}> but got <${langTags.join(', ')}>`
            )
          }
        }

        expect(mismatched, `Tag mismatches in ${lang}`).toEqual([])
      })

      it('has no untranslated values (same as English)', () => {
        const untranslated = Object.entries(data)
          .filter(([k, v]) =>
            (en as Record<string, string>)[k] === v &&
            !SAME_VALUE_ALLOWED.has(k) &&
            !SAME_VALUE_ALLOWED_BY_LANGUAGE[lang]?.has(k),
          )
          .map(([k]) => k)
        expect(untranslated, `Untranslated keys in ${lang}`).toEqual([])
      })

      it('has no empty values', () => {
        const empty = Object.entries(data)
          .filter(([, v]) => v.trim() === '')
          .map(([k]) => k)
        expect(empty, `Empty values in ${lang}`).toEqual([])
      })
    })
  }
})
