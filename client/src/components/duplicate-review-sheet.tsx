import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Calendar } from "lucide-react";

interface DuplicateReviewSheetProps {
  kind: "transaction" | "payment";
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₦0";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "₦0";
  return `₦${n.toLocaleString()}`;
}

interface PairResponse {
  kind: "transaction" | "payment";
  primary: any;
  counterpart: any | null;
}

export function DuplicateReviewSheet({ kind, id, open, onOpenChange }: DuplicateReviewSheetProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<PairResponse>({
    queryKey: ["/api/admin/duplicates", kind, id],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/duplicates/${kind}/${id}`, { method: "GET" });
      return res;
    },
    enabled: open && !!id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/duplicates", kind, id] });
  };

  const clearMutation = useMutation({
    mutationFn: async () => {
      const url = kind === "payment"
        ? `/api/admin/payments/${id}/clear-duplicate`
        : `/api/admin/bank-transactions/${id}/clear-duplicate`;
      return apiRequest(url, { method: "POST", body: {} });
    },
    onSuccess: () => {
      toast({ title: "Cleared", description: "Marked as not a duplicate." });
      invalidateAll();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      // Payments use 'reverse-as-duplicate'; bank transactions use 'ignore-as-duplicate'.
      const url = kind === "payment"
        ? `/api/admin/payments/${id}/reverse-as-duplicate`
        : `/api/admin/bank-transactions/${id}/ignore-as-duplicate`;
      const body = kind === "payment" ? { reason: "Reversed as duplicate from review panel" } : {};
      return apiRequest(url, { method: "POST", body });
    },
    onSuccess: () => {
      toast({
        title: kind === "payment" ? "Payment reversed" : "Transaction dismissed",
        description: kind === "payment"
          ? "Reversed as a duplicate."
          : "Dismissed from the duplicate review list.",
      });
      invalidateAll();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const renderColumn = (label: string, side: any, isPrimary: boolean) => {
    if (!side) {
      return (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
          <div className="text-sm text-muted-foreground">No counterpart found.</div>
        </div>
      );
    }
    const amount = side.amount;
    const date = kind === "transaction" ? side.transactionDate : side.paymentDate;
    const description = kind === "transaction"
      ? (side.rawDescription || side.normalizedDescription || "")
      : (side.depositorName || side.notes || "");
    const status = side.status || "—";
    const ref = side.reference || null;
    const studentName = kind === "payment" && side.student
      ? `${side.student.user?.lastName || ""} ${side.student.user?.firstName || ""}`.trim()
      : null;
    const studentId = kind === "payment" ? side.student?.studentId : null;
    return (
      <div className={`border rounded-lg p-3 ${isPrimary ? "border-amber-400 bg-amber-50/40" : "bg-muted/20"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          {isPrimary && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-400">
              Flagged
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-green-700">{fmtMoney(amount)}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <Calendar className="h-3 w-3" />
          {formatDate(date)}
        </div>
        {studentName && (
          <div className="text-sm font-medium mt-2">
            {studentName} {studentId && <Badge variant="outline" className="text-[10px] ml-1">{studentId}</Badge>}
          </div>
        )}
        {description && (
          <div className="text-xs text-muted-foreground mt-2 break-words">{description}</div>
        )}
        {ref && <div className="text-xs text-muted-foreground mt-1">Ref: {ref}</div>}
        <div className="mt-2">
          <Badge variant="secondary" className="text-[10px] uppercase">{status}</Badge>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Review possible duplicate
          </DialogTitle>
          <DialogDescription>
            Compare both entries before deciding. {kind === "payment"
              ? "If they describe the same payment, reverse this one as a duplicate."
              : "If they describe the same bank credit, dismiss this one. If not, mark it as not a duplicate."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3" data-testid="duplicate-review-error">
            Couldn't load this duplicate pair: {(error as Error).message}
          </div>
        ) : !data ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="duplicate-review-grid">
            {renderColumn("This entry", data.primary, true)}
            {renderColumn("Earlier entry", data.counterpart, false)}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                disabled={clearMutation.isPending || !data?.primary}
                onClick={() => clearMutation.mutate()}
                data-testid="button-review-clear"
              >
                {clearMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Not a duplicate
              </Button>
              <Button
                variant="destructive"
                disabled={dismissMutation.isPending || !data?.primary}
                onClick={() => {
                  if (window.confirm(kind === "payment"
                    ? "Reverse this payment as a duplicate?"
                    : "Dismiss this transaction as a duplicate?")) {
                    dismissMutation.mutate();
                  }
                }}
                data-testid="button-review-dismiss"
              >
                {dismissMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {kind === "payment" ? "Reverse as duplicate" : "Mark as ignored"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
