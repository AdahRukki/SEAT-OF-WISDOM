import { useId, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FinanceDataDetails({ children, label = "Data details" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-11 gap-2 text-muted-foreground print:hidden">
          <Info className="h-4 w-4" aria-hidden="true" />{label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-labelledby={titleId} className="w-96 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto print:hidden"
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id={titleId} className="font-semibold">{label}</h3>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Close ${label.toLowerCase()}`} onClick={() => setOpen(false)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
