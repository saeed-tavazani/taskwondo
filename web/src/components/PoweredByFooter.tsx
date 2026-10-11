import { Trans } from 'react-i18next'

export function PoweredByFooter() {
  return (
    <footer className="py-3 text-center">
      <p className="text-xs text-muted-foreground dark:text-muted-foreground">
        <Trans i18nKey="footer.poweredBy" components={{ brand: <a href="https://github.com/marcoshack/taskwondo" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-muted-foreground dark:hover:text-muted-foreground underline-offset-2 hover:underline" /> }} />
      </p>
    </footer>
  )
}
