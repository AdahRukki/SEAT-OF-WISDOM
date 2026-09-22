import { useId } from 'react';
import { ConfirmationDateFilter } from './confirmation-date-filter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PaymentDateFilters({from, to, onApply, firstOnly, onFirstChange, scopeReady}: {
  from: string; to: string; onApply: (from: string, to: string) => void;
  firstOnly: boolean; onFirstChange: (value: boolean) => void; scopeReady: boolean;
}) {
  const id = useId();
  const enabled = scopeReady && !!(from || to);
  return <div className="rounded-lg border bg-muted/20 p-3 space-y-2 print:hidden">
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
      <div className="space-y-1"><p className="text-sm font-medium">When was payment confirmed?</p>
        <ConfirmationDateFilter from={from} to={to} onApply={(start, end) => {if (!start && !end) onFirstChange(false); onApply(start, end);}} />
      </div>
      <div className="w-full sm:w-64 space-y-1">
        <label htmlFor={id} className="text-sm font-medium">Students to include</label>
        <Select value={firstOnly && enabled ? 'first' : 'all'} onValueChange={value => onFirstChange(value === 'first')} disabled={!enabled}>
          <SelectTrigger id={id} className="min-h-11 h-auto text-left [&>span]:whitespace-normal" aria-describedby={id + '-help'}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All matching students</SelectItem><SelectItem value="first">First payment in these dates</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
    <p id={id + '-help'} className="text-xs text-muted-foreground">{!enabled
      ? 'Choose confirmation dates, a term and a session to find first-time payments.'
      : firstOnly
        ? 'Students whose first confirmed payment this term falls in these dates. Totals include all their payments in the range. Older records with missing confirmation times cannot qualify.'
        : 'Include everyone paid in these dates, or narrow the list to students making their first payment this term.'}</p>
  </div>;
}
