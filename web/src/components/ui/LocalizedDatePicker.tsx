import DatePicker from 'react-multi-date-picker'
import type { DateObject } from 'react-multi-date-picker'
import type { KeyboardEventHandler } from 'react'
import persian from 'react-date-object/calendars/persian'
import gregorian from 'react-date-object/calendars/gregorian'
import persianFa from 'react-date-object/locales/persian_fa'
import gregorianEn from 'react-date-object/locales/gregorian_en'
import AnalogTimePicker from 'react-multi-date-picker/plugins/analog_time_picker'
import { useLanguage } from '@/contexts/LanguageContext'

interface LocalizedDatePickerProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
  type?: 'date' | 'datetime-local'
  dir?: 'ltr' | 'rtl' | 'auto'
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
}

const inputClass =
  'rmdp-input block w-full min-w-0 rounded-[0.625rem] border border-input px-3 py-1.5 text-sm shadow-xs bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring dark:bg-card dark:border-input dark:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'

function parseLocalDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) return undefined

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date, withTime: boolean): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return withTime
    ? `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : datePart
}

export function LocalizedDatePicker({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  className = '',
  type = 'date',
  dir,
  onKeyDown,
}: LocalizedDatePickerProps) {
  const { language } = useLanguage()
  const isPersian = language === 'fa'
  const withTime = type === 'datetime-local'
  const date = parseLocalDate(value)
  const pickerId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  function handleChange(selected: DateObject | DateObject[] | null) {
    if (!selected || Array.isArray(selected)) {
      onChange('')
      return
    }
    onChange(formatLocalDate(selected.toDate(), withTime))
  }

  return (
    <div className={`min-w-0 ${className}`} dir={dir ?? (isPersian ? 'rtl' : 'ltr')} onKeyDown={onKeyDown}>
      {label && (
        <label htmlFor={pickerId} className="mb-1 block text-sm font-medium text-foreground dark:text-foreground">
          {label}
        </label>
      )}
      <DatePicker
        id={pickerId}
        value={date}
        onChange={handleChange}
        calendar={isPersian ? persian : gregorian}
        locale={isPersian ? persianFa : gregorianEn}
        format={withTime ? 'YYYY/MM/DD HH:mm:ss' : 'YYYY/MM/DD'}
        calendarPosition={isPersian ? 'bottom-right' : 'bottom-left'}
        inputClass={inputClass}
        containerClassName="block w-full"
        disabled={disabled}
        required={required}
        plugins={withTime ? [<AnalogTimePicker key="analog-time" position="left" />] : []}
      />
    </div>
  )
}
