import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { adminPageHref, permittedAdminPages, selectedAdminPage } from '@/lib/admin-pages';

export function useAdminPage() {
  const { user } = useAuth();
  const [path, navigate] = useLocation();
  const search = useSearch();
  const activePage = selectedAdminPage(search, user?.role, user?.permissions);
  const selectPage = (page: string) => {
    const allowed = permittedAdminPages(user?.role, user?.permissions).find(item => item.id === page);
    if (allowed) navigate(adminPageHref(path, allowed.id, search));
  };
  return { activePage, selectPage };
}
