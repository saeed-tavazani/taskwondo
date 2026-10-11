import { Tooltip } from '@/components/ui/Tooltip'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSidebar } from '@/contexts/SidebarContext'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'
import { systemSettingsNavItems } from '@/utils/sidebarNav'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function SystemSettingsSidebar() {
  const { t } = useTranslation()
  const { collapsed, toggleCollapsed } = useSidebar('settings')
  const { guardRef, guardedNavigate } = useNavigationGuard()
  // Shared with the command palette's navigation catalog — see @/utils/sidebarNav
  const navItems = systemSettingsNavItems(t)

  function renderNavItems(showLabels: boolean) {
    return (
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <Tooltip content={!showLabels ? item.label : undefined} position="end" className="block w-full">
          <NavLink aria-label={item.label}
              to={item.to}
              end={item.end}
              onClick={(e) => {
                if (guardRef.current?.()) {
                  e.preventDefault()
                  guardedNavigate(item.to)
                }
              }}
              className={({ isActive }) =>
                `group/nav relative flex items-center gap-2 rounded-md text-sm font-medium transition-colors ${
                  !showLabels ? 'justify-center px-0 py-2' : 'px-2 py-1.5'
                } ${
                  isActive
                    ? 'bg-accent text-foreground dark:bg-accent dark:text-foreground'
                    : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showLabels && <span>{item.label}</span>}

            </NavLink>
        </Tooltip>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        className={`hidden sm:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-[240px]'
        }`}
      >
        {renderNavItems(!collapsed)}

        <div
          className={`mt-4 border-t border-border pt-4 dark:border-border ${
            collapsed ? 'flex justify-center' : ''
          }`}
        >
          <Tooltip content={collapsed ? t('sidebar.expand') : undefined} position="end" className="block w-full">
          <button
            onClick={toggleCollapsed}
            className={`group/toggle relative flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground ${
              collapsed ? 'justify-center px-0 py-2 w-full' : 'px-2 py-1.5 w-full'
            }`}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0 rtl:rotate-180" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0 rtl:rotate-180" />
                <span>{t('sidebar.collapse')}</span>
              </>
            )}

          </button>
        </Tooltip>
        </div>
      </nav>

    </>
  )
}
