import { Tooltip } from '@/components/ui/Tooltip'
import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'
import { useNamespacePath, toUrlSegment } from '@/hooks/useNamespacePath'
import { useNamespaceContext } from '@/contexts/NamespaceContext'
import { useLastProjectKey, setLastProjectKey } from '@/hooks/useLastProjectKey'
import { NamespaceIcon } from '@/components/NamespaceIcon'
import { CreateNamespaceModal } from '@/components/CreateNamespaceModal'
import { useInboxCount } from '@/hooks/useInbox'
import {
  isCustomerOnly as isCustomerOnlyUser,
  isCustomerProject as isCustomerInProject,
  projectNavItems,
  userNavItems,
  timeNavItems,
} from '@/utils/sidebarNav'
import type { SidebarNavItem } from '@/utils/sidebarNav'
import { useTimeProjects } from '@/hooks/useTimeTracking'
import {
  FolderKanban,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react'

interface AppSidebarProps {
  projectKey?: string
  /** True when the active project is a customer-role project (show only Support nav) */
  customerProject?: boolean
  /** Render only the mobile overlay (used in AppShell for global availability) */
  mobileOnly?: boolean
}

interface NavItem extends SidebarNavItem {
  badge?: number
}

export function AppSidebar({ projectKey, customerProject, mobileOnly }: AppSidebarProps) {
  const { t } = useTranslation()
  const { p } = useNamespacePath()
  const { canTrackTime } = useTimeProjects()
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar('app')
  const { guardRef, guardedNavigate } = useNavigationGuard()
  const location = useLocation()
  const { namespaces, activeNamespace, setActiveNamespace, showSwitcher } = useNamespaceContext()
  const { data: inboxCount } = useInboxCount()
  const [nsDropdownOpen, setNsDropdownOpen] = useState(false)
  const [nsCreateOpen, setNsCreateOpen] = useState(false)
  const nsRef = useRef<HTMLDivElement>(null)

  // Close namespace dropdown on click outside
  useEffect(() => {
    if (!nsDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (nsRef.current && !nsRef.current.contains(e.target as Node)) {
        setNsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [nsDropdownOpen])

  // Remember the last active project so sidebar persists on /projects and /user pages.
  // Backed by useSyncExternalStore in useLastProjectKey so all components stay in sync
  // when the stored key is cleared (e.g. the remembered project no longer exists).
  const storedLastProjectKey = useLastProjectKey()

  useEffect(() => {
    if (projectKey && projectKey !== storedLastProjectKey) {
      setLastProjectKey(projectKey)
    }
  }, [projectKey, storedLastProjectKey])

  const activeProjectKey = projectKey ?? storedLastProjectKey ?? undefined
  const { user } = useAuth()

  // Detect customer project: explicit prop or derived from portal_projects for the remembered project
  const isCustomerProject = !!customerProject
    || (!projectKey && isCustomerInProject(user, activeProjectKey))

  // Hide inbox/watchlist/feed when user is a customer in ALL their projects
  const isCustomerOnly = isCustomerOnlyUser(user)

  // Close mobile sidebar and namespace dropdown on route change
  useEffect(() => {
    closeMobile()
    setNsDropdownOpen(false)
  }, [location.pathname, closeMobile])

  // Nav definitions are shared with the command palette's navigation catalog —
  // see @/utils/sidebarNav. Only the inbox badge is sidebar-specific.
  const userNav: NavItem[] = userNavItems(t).map((item) =>
    item.to === '/user/inbox'
      ? { ...item, badge: inboxCount && inboxCount > 0 ? inboxCount : undefined }
      : item,
  )

  const projectBase = activeProjectKey ? p(`/projects/${activeProjectKey}`) : ''

  const projectNav: NavItem[] = activeProjectKey
    ? projectNavItems(t, projectBase, isCustomerProject)
    : []

  function renderNavItem(item: NavItem, showLabels: boolean) {
    return (
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
            `group/nav relative flex items-center gap-2 rounded-md text-sm font-medium transition-colors min-w-0 ${
              !showLabels ? 'justify-center px-0 py-2' : 'px-2 py-1.5'
            } ${
              isActive
                ? 'bg-accent text-foreground dark:bg-accent dark:text-foreground'
                : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
            }`
          }
        >
          <span className="relative shrink-0">
            <item.icon className="h-4 w-4" />
            {!showLabels && item.badge != null && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </span>
          {showLabels && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && (
                <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent dark:bg-accent px-1.5 text-xs font-medium text-foreground dark:text-foreground">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </>
          )}

        </NavLink>
        </Tooltip>
      </li>
    )
  }

  function renderProjectsLink(showLabels: boolean) {
    // When a project is active: expanded shows icon + Projects + badge right-aligned; collapsed shows full-width badge
    if (activeProjectKey) {
      if (!showLabels) {
        // Collapsed: full-width project key badge
        return (
          <li>
            <Tooltip content={t('sidebar.projects')} position="end" className="block w-full">
          <NavLink aria-label={t('sidebar.projects')}
              to={p('/projects')}
              end
              onClick={(e) => {
                if (guardRef.current?.()) {
                  e.preventDefault()
                  guardedNavigate(p('/projects'))
                }
              }}
              className={({ isActive }) =>
                `group/nav relative flex items-center justify-center rounded-md text-sm font-bold transition-colors min-w-0 px-0 py-2 ${
                  isActive
                    ? 'bg-accent text-foreground dark:bg-accent dark:text-foreground'
                    : 'bg-accent text-foreground hover:bg-accent dark:bg-accent dark:text-foreground dark:hover:bg-accent'
                }`
              }
            >
              {activeProjectKey}

            </NavLink>
        </Tooltip>
          </li>
        )
      }

      // Expanded: icon + Projects text + badge on the right
      return (
        <li>
          <NavLink
            to={p('/projects')}
            end
            onClick={(e) => {
              if (guardRef.current?.()) {
                e.preventDefault()
                guardedNavigate(p('/projects'))
              }
            }}
            className={({ isActive }) =>
              `group/nav relative flex items-center gap-2 rounded-md text-sm font-medium transition-colors min-w-0 px-2 py-1.5 ${
                isActive
                  ? 'bg-accent text-foreground dark:bg-accent dark:text-foreground'
                  : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
              }`
            }
          >
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{t('sidebar.projects')}</span>
            <span className="ms-auto inline-flex items-center justify-center rounded-md bg-accent dark:bg-accent text-foreground dark:text-foreground text-xs font-bold px-1.5 py-1 shrink-0">
              {activeProjectKey}
            </span>
          </NavLink>
        </li>
      )
    }

    return (
      <li>
        <Tooltip content={!showLabels ? t('sidebar.projects') : undefined} position="end" className="block w-full">
          <NavLink aria-label={t('sidebar.projects')}
          to={p('/projects')}
          end
          onClick={(e) => {
            if (guardRef.current?.()) {
              e.preventDefault()
              guardedNavigate(p('/projects'))
            }
          }}
          className={({ isActive }) =>
            `group/nav relative flex items-center gap-2 rounded-md text-sm font-medium transition-colors min-w-0 ${
              !showLabels ? 'justify-center px-0 py-2' : 'px-2 py-1.5'
            } ${
              isActive
                ? 'bg-accent text-foreground dark:bg-accent dark:text-foreground'
                : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
            }`
          }
        >
          <FolderKanban className="h-4 w-4 shrink-0" />
          {showLabels && <span className="truncate">{t('sidebar.projects')}</span>}

        </NavLink>
        </Tooltip>
      </li>
    )
  }

  function renderNamespaceBanner(showLabels: boolean) {
    if (!showSwitcher || !activeNamespace) return null

    return (
      <div className="relative mb-1" ref={nsRef}>
        <Tooltip content={!showLabels ? activeNamespace.display_name : undefined} position="end" className="block w-full">
          <button
          onClick={() => setNsDropdownOpen(!nsDropdownOpen)}
          className={`group/ns w-full flex items-center gap-2.5 rounded-md text-sm font-semibold transition-colors ${
            showLabels ? 'px-2 py-1.5' : 'justify-center py-2'
          } text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-card`}
          aria-label={t('namespaces.switchNamespace')}
        >
          <NamespaceIcon icon={activeNamespace.icon} color={activeNamespace.color} className="h-4 w-4 shrink-0" />
          {showLabels && (
            <span className="flex-1 truncate text-start">{activeNamespace.display_name}</span>
          )}

        </button>
        </Tooltip>
        {nsDropdownOpen && (
          <div className={`absolute z-50 w-64 bg-surface dark:bg-card backdrop-blur-sm rounded-md shadow-lg border border-border dark:border-border py-1 ${
            showLabels ? 'start-0 top-full mt-1' : 'start-full top-0 ms-2'
          }`}>
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
              {t('namespaces.title')}
            </div>
            {namespaces.map((ns) => (
              <button
                key={ns.slug}
                onClick={() => {
                  setNsDropdownOpen(false)
                  if (ns.slug !== activeNamespace.slug) {
                    setActiveNamespace(ns.slug)
                  }
                }}
                className={`w-full text-start px-2 py-1.5 text-sm flex items-center gap-2.5 ${
                  ns.slug === activeNamespace.slug
                    ? 'bg-accent dark:bg-accent text-foreground dark:text-foreground'
                    : 'text-foreground dark:text-foreground hover:bg-muted dark:hover:bg-muted'
                }`}
              >
                <NamespaceIcon icon={ns.icon} color={ns.color} className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{ns.display_name}</div>
                  {!ns.is_default && <div className="text-xs text-muted-foreground dark:text-muted-foreground">{ns.slug}</div>}
                </div>
                {ns.slug === activeNamespace.slug && (
                  <span className="text-xs text-foreground dark:text-foreground shrink-0">{t('common.current')}</span>
                )}
                {!ns.is_default && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setNsDropdownOpen(false)
                      guardedNavigate(`/${toUrlSegment(ns.slug)}/settings`)
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground shrink-0"
                    aria-label={t('namespaces.settings')}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                )}
              </button>
            ))}
            <div className="border-t border-border dark:border-border mt-1 pt-1">
              <button
                onClick={() => {
                  setNsDropdownOpen(false)
                  setNsCreateOpen(true)
                }}
                className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-muted flex items-center gap-2.5"
              >
                <Plus className="h-4 w-4" />
                {t('namespaces.createNew')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderContent(showLabels: boolean) {
    return (
      <>
        {/* User section — hidden when user is customer in all projects */}
        {!isCustomerOnly && (
          <>
            <ul className="space-y-1">
              {userNav.map((item) => renderNavItem(item, showLabels))}
            </ul>

            {/* Separator */}
            <div className="border-t border-border dark:border-border my-2" />
          </>
        )}

        {/* Namespace banner */}
        {renderNamespaceBanner(showLabels)}

        {/* Projects section */}
        <ul className="space-y-1">
          {renderProjectsLink(showLabels)}
        </ul>

        {/* Active project context */}
        {activeProjectKey && projectNav.length > 0 && (
          <ul className="space-y-1 mt-1">
            {projectNav.map((item) => renderNavItem(item, showLabels))}
          </ul>
        )}
        {canTrackTime && <ul className="mt-3 space-y-1 border-t border-border pt-3 dark:border-border">
          {timeNavItems(t, p('')).map(item => renderNavItem(item, showLabels))}
        </ul>}
      </>
    )
  }

  const createModal = (
    <CreateNamespaceModal
      open={nsCreateOpen}
      onClose={() => setNsCreateOpen(false)}
      onCreated={(ns) => {
        setNsCreateOpen(false)
        setActiveNamespace(ns.slug)
        guardedNavigate(`/${toUrlSegment(ns.slug)}/settings`)
      }}
    />
  )

  if (mobileOnly) {
    // Render only the mobile dropdown overlay (used in AppShell for global availability)
    return (
      <>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 sm:hidden" onClick={closeMobile}>
            <nav
              className="absolute end-4 top-14 w-52 bg-surface dark:bg-card rounded-lg shadow-lg border border-border dark:border-border p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {renderContent(true)}
            </nav>
          </div>
        )}
        {createModal}
      </>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        className={`hidden sm:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-48'
        }`}
      >
        {renderContent(!collapsed)}

        <div
          className={`mt-4 border-t border-border pt-4 dark:border-border ${
            collapsed ? 'flex justify-center' : ''
          }`}
        >
          <Tooltip content={collapsed ? t('sidebar.expand') : undefined} position="end" className="block w-full">
          <button
            onClick={toggleCollapsed}
            className={`group/toggle relative flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground dark:hover:bg-card dark:hover:text-foreground min-w-0 ${
              collapsed ? 'justify-center px-0 py-2 w-full' : 'px-2 py-1.5 w-full'
            }`}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0 rtl:rotate-180" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0 rtl:rotate-180" />
                <span className="truncate">{t('sidebar.collapse')}</span>
              </>
            )}

          </button>
        </Tooltip>
        </div>
      </nav>
      {createModal}
    </>
  )
}
