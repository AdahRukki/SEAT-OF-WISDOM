import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { canOpenSchool } from '@/lib/admin-navigation';
import { Button } from '@/components/ui/button';
import AdminDashboard from '@/pages/admin-dashboard';
import type { School } from '@shared/schema';

// Validate the real school before mounting any school-operation queries.
export default function AdminSchool() {
  const { schoolId = '' } = useParams<{ schoolId: string }>();
  const { user } = useAuth();
  const { data: schools = [], isPending, isError, refetch } = useQuery<School[]>({
    queryKey: ['/api/admin/schools'],
    enabled: user?.role === 'admin',
  });
  if (user?.role === 'admin' && isPending) return <main className="p-8" role="status">Loading school branch…</main>;
  if (user?.role === 'admin' && isError) return <main className="space-y-4 p-8"><p role="alert">School branches could not be loaded.</p><Button onClick={() => void refetch()}>Retry</Button></main>;
  if (!canOpenSchool(user?.role, user?.schoolId, schoolId, schools)) return <main className="space-y-4 p-8"><h1 className="text-xl font-semibold">School unavailable</h1><p>Choose an available school from your dashboard.</p><Button asChild><Link href="/admin">Return to dashboard</Link></Button></main>;
  return <AdminDashboard key={schoolId} schoolId={schoolId} />;
}
