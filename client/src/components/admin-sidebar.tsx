import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { BookOpen, Building2, ChevronDown, ClipboardCheck, FileText, Globe2, History, Inbox, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings, Users, Wallet, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ADMIN_GROUPS, ADMIN_PAGES, adminPageHref, permittedAdminPages, selectedAdminPage } from '@/lib/admin-pages';
import { GENERAL_SCHOOL_PATH, SCHOOL_SELECTION_PATH } from '@/lib/admin-navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const icons = { overview: LayoutDashboard, students: Users, scores: BookOpen, grading: ClipboardCheck, finance: Wallet, reports: FileText, users: Settings, news: Bell, inquiries: Inbox, activity: History };
type Preferences = { collapsed: boolean; groups: Record<string, boolean> };
const NavigationContext = createContext(false);

function readPreferences(key: string): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    const groups: Record<string, boolean> = {};
    for (const group of ADMIN_GROUPS) groups[group] = typeof value?.groups?.[group] === 'boolean' ? value.groups[group] : true;
    return { collapsed: value?.collapsed === true, groups };
  } catch { return { collapsed: false, groups: {} }; }
}

export function AdminMenuButton() {
  if (!useContext(NavigationContext)) return null;
  return <SheetTrigger asChild><Button variant="outline" size="icon" className="h-11 w-11 shrink-0 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>;
}

// Keep the shell mounted across routes so drawer focus and preferences survive
// navigation. Authentication and route/school guards remain in their existing pages.
export default function AdminSidebar({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [path] = useLocation();
  if (!user || !['admin', 'sub-admin'].includes(user.role) || path === '/login') return <>{children}</>;
  return <SidebarLayout key={user.id} user={user}>{children}</SidebarLayout>;
}

function SidebarLayout({ user, children }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; children: ReactNode }) {
  const [path] = useLocation();
  const search = useSearch();
  const key = `sowa:admin-navigation:${user.id}`;
  const [preferences, setPreferences] = useState(() => readPreferences(key));
  const [open, setOpen] = useState(false);
  const navigationClose = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const branch = path.startsWith('/admin/school/');
  const dashboard = branch || user.role === 'sub-admin' && (path === '/' || path === '/admin');
  const activePage = dashboard ? selectedAdminPage(search, user.role, user.permissions) : null;
  const activeGroup = ADMIN_PAGES.find(page => page.id === activePage)?.group ?? (path === '/users' || path === '/profile' ? 'Administration' : 'Overview');
  const activeKey = `${path}?${search}`;
  const pages = permittedAdminPages(user.role, user.permissions);
  const schoolPath = branch ? path : user.role === 'admin' ? SCHOOL_SELECTION_PATH : '/admin';

  useEffect(() => {
    setPreferences(previous => previous.groups[activeGroup] !== false ? previous : { ...previous, groups: { ...previous.groups, [activeGroup]: true } });
  }, [activeKey, activeGroup]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Private browsing must not block navigation. */ }
  }, [key, preferences]);

  useEffect(() => {
    // A link, browser Back/Forward, or a school change must never leave a drawer
    // overlay obscuring the next page.
    setOpen(false);
  }, [activeKey]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const close = () => setOpen(false);
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);

  function selected() { navigationClose.current = open; setOpen(false); }

  function item(label: string, href: string, Icon: typeof Users, active: boolean, collapsed: boolean) {
    const link = <Link href={href} onClick={selected} aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn('flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', active ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-100' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground', collapsed && 'justify-center px-2')}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{!collapsed && <span>{label}</span>}
    </Link>;
    return collapsed ? <Tooltip key={label}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : <div key={label}>{link}</div>;
  }

  function navigation(collapsed: boolean) {
    return <nav aria-label="Admin navigation" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {ADMIN_GROUPS.map(group => {
        const entries = pages.filter(page => page.group === group);
        const overview = group === 'Overview' && user.role === 'admin';
        const administration = group === 'Administration' && user.role === 'admin';
        if (!entries.length && !overview && !administration) return null;
        const expanded = preferences.groups[group] !== false;
        return <section key={group} aria-label={group} className="space-y-1">
          {collapsed ? <div className="mx-2 border-t first:mt-0" /> : <button type="button"
            className="flex min-h-11 w-full items-center justify-between rounded-md px-3 text-xs font-semibold tracking-wide text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded} aria-controls={`admin-group-${group}${open ? '-drawer' : ''}`}
            onClick={() => setPreferences(previous => ({ ...previous, groups: { ...previous.groups, [group]: !expanded } }))}>
            {group}<ChevronDown className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')} aria-hidden="true" />
          </button>}
          {(collapsed || expanded) && <div id={`admin-group-${group}${open ? '-drawer' : ''}`} className="space-y-1">
            {overview && <>
              {item('General School', GENERAL_SCHOOL_PATH, Globe2, ['/', '/admin', GENERAL_SCHOOL_PATH].includes(path), collapsed)}
              {item('Choose a school', SCHOOL_SELECTION_PATH, Building2, path === SCHOOL_SELECTION_PATH, collapsed)}
            </>}
            {entries.map(page => item(page.label, adminPageHref(schoolPath, page.id), icons[page.icon], activePage === page.id, collapsed))}
            {administration && item('Users', '/users', Users, path === '/users', collapsed)}
          </div>}
        </section>;
      })}
    </nav>;
  }

  return <NavigationContext.Provider value={true}><Sheet open={open} onOpenChange={setOpen}>
    <div className="admin-portal flex min-h-screen min-w-0 bg-gray-50 dark:bg-gray-900 print:block">
      <a href="#admin-content" className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-background p-3 focus:not-sr-only">Skip to page content</a>
      <aside data-testid="admin-sidebar" data-collapsed={preferences.collapsed} aria-label="Desktop navigation"
        className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-background lg:flex print:hidden', preferences.collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex min-h-16 items-center border-b px-3', preferences.collapsed ? 'justify-center px-2' : 'justify-between gap-2')}>
          {!preferences.collapsed && <span className="text-sm font-semibold">Seat of Wisdom</span>}
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0"
            aria-label={preferences.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!preferences.collapsed}
            onClick={() => setPreferences(previous => ({ ...previous, collapsed: !previous.collapsed }))}>
            {preferences.collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>
        {!open && navigation(preferences.collapsed)}
      </aside>
      <div id="admin-content" ref={content} tabIndex={-1} className="admin-portal-content min-w-0 flex-1 outline-none">{children}</div>
    </div>
    <SheetContent side="left" className="flex w-[min(20rem,90vw)] max-w-full flex-col gap-0 p-0 [&>button]:inline-flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"
      onCloseAutoFocus={event => {
        if (navigationClose.current) { event.preventDefault(); content.current?.focus(); navigationClose.current = false; }
      }}>
      <SheetHeader className="border-b px-6 py-5 pr-16 text-left"><SheetTitle>Seat of Wisdom</SheetTitle><SheetDescription>Administrator navigation</SheetDescription></SheetHeader>
      {navigation(false)}
    </SheetContent>
  </Sheet></NavigationContext.Provider>;
}
