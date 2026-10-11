import { useTranslation } from 'react-i18next'
import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ScrollableDateProps {
  date: string
  className?: string
}

export function ScrollableDate({ date, className = '' }: ScrollableDateProps) {
  const { i18n } = useTranslation()
  const ref = useRef<HTMLSpanElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(Math.abs(el.scrollLeft) > 0)
    setCanScrollRight(Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkScroll, date])

  return (
    <span className={`relative inline-flex items-center min-w-0 ${className}`}>
      {canScrollLeft && (
        <>
          <span className="absolute start-0 top-0 bottom-0 w-4 bg-gradient-to-r rtl:bg-gradient-to-l from-surface dark:from-background to-transparent z-10 pointer-events-none" />
          <ChevronLeft
            className="absolute start-0 w-3 h-3 rtl:rotate-180 text-muted-foreground dark:text-muted-foreground z-20 pointer-events-none"
          />
        </>
      )}
      <span
        ref={ref}
        className="overflow-x-auto scrollbar-none text-xs text-muted-foreground dark:text-muted-foreground whitespace-nowrap min-w-0"
        onScroll={checkScroll}
      >
        {new Date(date).toLocaleString(i18n.language)}
      </span>
      {canScrollRight && (
        <>
          <span className="absolute end-0 top-0 bottom-0 w-4 bg-gradient-to-l rtl:bg-gradient-to-r from-surface dark:from-background to-transparent z-10 pointer-events-none" />
          <ChevronRight
            className="absolute end-0 w-3 h-3 rtl:rotate-180 text-muted-foreground dark:text-muted-foreground z-20 pointer-events-none"
          />
        </>
      )}
    </span>
  )
}
