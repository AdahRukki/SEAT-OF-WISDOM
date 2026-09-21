import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function nigeriaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return value("year") + "-" + value("month") + "-" + value("day");
}
export function confirmationPreset(preset: string, now = new Date()): [string, string] {
  const today = nigeriaToday(now);
  const shift = (days: number) => new Date(Date.parse(today + "T12:00:00Z") + days * 86400000).toISOString().slice(0, 10);
  if (preset === "today") return [today, today];
  if (preset === "yesterday") return [shift(-1), shift(-1)];
  if (preset === "week") return [shift(-6), today];
  if (preset === "month") return [today.slice(0, 7) + "-01", today];
  return ["", ""];
}
export function confirmationRangeLabel(from: string, to: string): string {
  const format = (day: string) => new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}).format(new Date(day + "T12:00:00Z"));
  if (!from && !to) return "All dates";
  if (from === to) return format(from);
  return (from ? format(from) : "Earliest") + " – " + (to ? format(to) : "Latest");
}
export function ConfirmationDateFilter({ from, to, onApply }: {
  from: string; to: string; onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const id = useId();
  useEffect(() => { if (open) { setDraftFrom(from); setDraftTo(to); } }, [open, from, to]);
  const invalid = !!(draftFrom && draftTo && draftFrom > draftTo);
  const apply = (start: string, end: string) => { onApply(start, end); setOpen(false); };
  return <div className="flex flex-wrap items-center gap-2 print:hidden">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-h-11 h-auto whitespace-normal text-left" aria-label={"Confirmation dates: " + confirmationRangeLabel(from, to)}>
          Confirmed: {confirmationRangeLabel(from, to)} <span aria-hidden="true" className="ml-2">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] max-h-[80dvh] overflow-y-auto space-y-4">
        <div><p className="font-semibold">Confirmation date</p><p className="text-sm text-muted-foreground">Nigerian time · Includes both selected days. Your term and session filters still apply.</p></div>
        <div className="grid grid-cols-2 gap-2">
          {([["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["month", "This month"]] as const).map(([value, label]) =>
            <Button type="button" key={value} variant="outline" className="min-h-11" onClick={() => apply(...confirmationPreset(value))}>{label}</Button>)}
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
          <label htmlFor={id + "-from"} className="text-sm space-y-1 block">From
            <Input id={id + "-from"} type="date" className="min-w-0 w-full h-11" value={draftFrom} max={draftTo || undefined} onChange={e => setDraftFrom(e.target.value)} />
          </label>
          <label htmlFor={id + "-to"} className="text-sm space-y-1 block">To
            <Input id={id + "-to"} type="date" className="min-w-0 w-full h-11" value={draftTo} min={draftFrom || undefined} onChange={e => setDraftTo(e.target.value)} />
          </label>
        </div>
        {invalid && <p role="alert" className="text-sm text-destructive">Choose an end date on or after the start date.</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => apply("", "")}>All dates</Button>
          <Button type="button" className="min-h-11" disabled={invalid} onClick={() => apply(draftFrom, draftTo)}>Apply dates</Button>
        </div>
      </PopoverContent>
    </Popover>
    {(from || to) && <Button type="button" variant="ghost" className="min-h-11" onClick={() => apply("", "")}>Clear dates</Button>}
  </div>;
}
