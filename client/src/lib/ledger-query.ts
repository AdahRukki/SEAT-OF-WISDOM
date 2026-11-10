import { apiRequest } from "./queryClient";
import type { LedgerResponse } from "@/components/payment-ledger";

// A single cache entry supplies school-wide cards and the unfiltered ledger.
export function ledgerQueryOptions(schoolId?: string, term?: string, session?: string,
  confirmedFrom = "", confirmedTo = "", firstPaymentOnly = false, enabled = true) {
  const params = new URLSearchParams();
  if (schoolId) params.set("schoolId", schoolId);
  if (term) params.set("term", term);
  if (session) params.set("session", session);
  if (confirmedFrom) params.set("confirmedFrom", confirmedFrom);
  if (confirmedTo) params.set("confirmedTo", confirmedTo);
  if (firstPaymentOnly) params.set("firstPaymentOnly", "true");
  return {
    queryKey: ["/api/payments/ledger", schoolId, term, session, confirmedFrom, confirmedTo, firstPaymentOnly],
    queryFn: (): Promise<LedgerResponse> => apiRequest(`/api/payments/ledger?${params}`),
    enabled: enabled && !!schoolId && !!term && !!session,
    staleTime: 0,
    refetchOnWindowFocus: true,
  };
}
