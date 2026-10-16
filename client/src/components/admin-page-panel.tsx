import type { ReactNode } from 'react';

// These are pages in the sidebar. Related tabs inside the pages keep their
// existing components and behavior.
export function AdminPagePanel({ activePage, value, className, children }: {
  activePage: string | null; value: string; className?: string; children: ReactNode;
}) {
  if (activePage !== value) return null;
  return <section className={className} aria-labelledby="admin-page-title">{children}</section>;
}
