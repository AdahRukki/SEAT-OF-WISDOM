import { analyticsFailure } from '@/lib/analytics-failure';
import { Button } from '@/components/ui/button';
export function ReportFailure({ error, label, retry, button }: { error: unknown; label: string; retry: () => void; button: string }) {
  const failure = analyticsFailure(error);
  return <div className="space-y-3"><div role="alert" className="space-y-2"><h2 className="font-semibold">{failure.title}</h2><p className="text-sm">{label} could not be loaded. {failure.message}</p>{failure.reference && <p className="break-all text-xs text-muted-foreground">Error reference: {failure.reference}</p>}</div><Button variant="outline" onClick={retry}>{button}</Button></div>;
}
