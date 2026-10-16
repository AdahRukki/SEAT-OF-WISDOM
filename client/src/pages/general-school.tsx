import { Link, useLocation, useSearch } from 'wouter';
import { AdminMenuButton } from '@/components/admin-sidebar';
import { preserveAdminPage } from '@/lib/admin-pages';
import { GENERAL_SCHOOL_OPTION, schoolSelectionPath } from '@/lib/admin-navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Building2, ArrowRight, LogOut, Users, User, Globe2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLogo } from '@/hooks/use-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GENERAL_SCHOOL_PATH, SCHOOL_SELECTION_PATH, schoolManagementPath } from '@/lib/admin-navigation';
import type { School } from '@shared/schema';
import GeneralSchoolAnalytics from '@/components/analytics/general-school-analytics';

export function ManagementAccessDenied() {
  return <main className="min-h-screen bg-gray-50 px-4 py-16 dark:bg-gray-900">
    <Card className="mx-auto max-w-lg"><CardHeader><CardTitle><h1>Main administrator access required</h1></CardTitle></CardHeader>
      <CardContent className="space-y-4"><p className="text-muted-foreground">General School is available to the main administrator.</p>
        <Button asChild><Link href="/admin">Return to your dashboard</Link></Button>
      </CardContent></Card>
  </main>;
}

// The guard runs before mounting the data page, including on direct URLs.
export default function GeneralSchool({ selectionOnly = false }: { selectionOnly?: boolean }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <ManagementAccessDenied />;
  return <ManagementHome selectionOnly={selectionOnly} />;
}

export function SchoolSelection() {
  return <GeneralSchool selectionOnly />;
}

function ManagementHome({ selectionOnly }: { selectionOnly: boolean }) {
  const [, navigate] = useLocation();
  const pageSearch = useSearch();
  const { user, logout } = useAuth();
  const { logoUrl } = useLogo();
  const { data: schools = [], isPending, isError, refetch } = useQuery<School[]>({
    queryKey: ['/api/admin/schools'],
  });

  return <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
    <header className="border-b bg-white dark:bg-gray-800">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <AdminMenuButton />
          <img src={logoUrl} alt="Seat of Wisdom Academy" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1" />
          <div><p className="text-base font-bold sm:text-lg">Seat of Wisdom Academy</p><p className="text-sm text-muted-foreground">Main Administrator</p></div>
        </div>
        <div className="min-w-0 w-full sm:w-56"><Select value={GENERAL_SCHOOL_OPTION} onValueChange={value => { const destination = schoolSelectionPath(value, schools); if (destination) navigate(preserveAdminPage(destination, pageSearch)); }}><SelectTrigger aria-label="School" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENERAL_SCHOOL_OPTION}>General School — All Schools</SelectItem>{schools.map(school => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}</SelectContent></Select></div>
        <nav aria-label="Administrator account" className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/users"><Users className="mr-2 h-4 w-4" />Users</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/profile"><User className="mr-2 h-4 w-4" />{user?.firstName}</Link></Button>
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

      <section className="rounded-2xl bg-blue-950 p-6 text-white sm:p-8" aria-labelledby="management-heading">
        <p className="mb-2 text-sm font-medium text-blue-200">Academy management</p>
        <h1 id="management-heading" className="text-3xl font-bold sm:text-4xl">{selectionOnly ? 'Choose your school' : 'General School'}</h1>
        <p className="mt-3 max-w-2xl text-blue-100">{selectionOnly ? 'Open General School for the academy view, or choose a branch to manage its students, assessments and payments.' : 'All Schools — monitor population, enrolment, retention, finance and learning across the academy. Compare recorded terms and sessions.'}</p>
      </section>
      {!selectionOnly && user && <GeneralSchoolAnalytics userId={user.id} />}
      <section aria-labelledby="branches-heading" className="space-y-4">
        <h2 id="branches-heading" className="text-xl font-semibold">{selectionOnly ? 'Available management views' : 'School branches'}</h2>
        {selectionOnly && <Card className="border-blue-200 dark:border-blue-800"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3"><Globe2 className="h-6 w-6 text-blue-600" /><div><h3 className="font-semibold">General School — All Schools</h3><p className="text-sm text-muted-foreground">Academy management overview</p></div></div>
          <Button asChild><Link href={GENERAL_SCHOOL_PATH}>Open General School<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent></Card>}
        {isPending ? <p role="status" className="py-8 text-muted-foreground">Loading school branches…</p>
          : isError ? <Card><CardContent className="space-y-3 p-6"><p role="alert">School branches could not be loaded. Please try again.</p><Button variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card>
          : schools.length === 0 ? <p className="py-8 text-muted-foreground">No school branches are available.</p>
          : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{schools.map(school => <Card key={school.id} className="flex flex-col">
            <CardHeader><Building2 className="mb-2 h-7 w-7 text-blue-600" /><CardTitle className="text-lg"><h3>{school.name}</h3></CardTitle></CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <dl className="space-y-2 text-sm"><div><dt className="text-muted-foreground">Academic session</dt><dd className="font-medium">{school.currentSession || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Current term</dt><dd className="font-medium">{school.currentTerm || 'Not recorded'}</dd></div></dl>
              <Button asChild variant="outline" className="mt-auto w-full"><Link href={preserveAdminPage(schoolManagementPath(school.id), pageSearch)} aria-label={`Manage ${school.name}`}>Manage branch<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>)}</div>}
      </section>
    </main>
  </div>;
}
