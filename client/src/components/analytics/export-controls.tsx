import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogo } from '@/hooks/use-logo';
import type { AnalyticsExportDocument } from '@shared/analytics-export';

export function ExportControls({ makeDocument, disabled = false }: { makeDocument: () => AnalyticsExportDocument; disabled?: boolean }) {
  const { logoUrl } = useLogo();
  const running = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const download = async (format: 'xlsx' | 'pdf') => {
    if (running.current || disabled) return;
    running.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const doc = makeDocument();
      const { downloadAnalyticsExport } = await import('@/lib/download-analytics-export');
      await downloadAnalyticsExport(doc, format, logoUrl);
      setStatus(`${format === 'xlsx' ? 'Excel' : 'PDF'} download prepared.`);
    } catch { setError('The report could not be exported. Please try again.'); }
    finally { running.current = false; setBusy(false); }
  };
  return <div className="space-y-2" aria-label="Report exports"><div className="flex flex-wrap gap-2">
    <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => void download('xlsx')}><Download className="mr-2 h-4 w-4" />Download Excel</Button>
    <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => void download('pdf')}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
  </div>{busy && <p role="status" className="text-sm text-muted-foreground">Preparing report download…</p>}{status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}</div>;
}
