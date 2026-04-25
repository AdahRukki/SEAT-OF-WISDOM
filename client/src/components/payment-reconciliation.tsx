import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link,
  Loader2,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Calendar,
  Trash2,
  Search,
} from "lucide-react";
import type { FeePaymentRecordWithDetails } from "@shared/schema";

// "12 Jan 2025" — timezone-safe for YYYY-MM-DD strings and Date objects.
function formatRecoDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  let d: Date;
  if (typeof value === "string") {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (dateOnly) {
      const [y, m, day] = value.split("-").map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(value);
    }
  } else {
    d = value;
  }
  if (isNaN(d.getTime())) return "N/A";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function toLocalDate(value: string | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function calendarDayDiff(a: string | Date, b: string | Date): number {
  const da = toLocalDate(a);
  const db = toLocalDate(b);
  const startA = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
  const startB = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
  return Math.round(Math.abs(startA - startB) / 86400000);
}

interface BankStatement {
  id: string;
  fileName: string;
  fileType: string;
  totalTransactions: number | null;
  newTransactions: number | null;
  duplicatesSkipped: number | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  createdAt: Date | null;
}

interface BankTransaction {
  id: string;
  transactionDate: Date;
  amount: string;
  transactionType: string;
  rawDescription: string;
  normalizedDescription: string | null;
  reference: string | null;
  status: string;
  matchConfidence: number | null;
  bankFormat?: string | null;
}

interface PaymentReconciliationProps {
  schoolId?: string;
}

export function PaymentReconciliation({ schoolId }: PaymentReconciliationProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<FeePaymentRecordWithDetails | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isReverseDialogOpen, setIsReverseDialogOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [deleteStatementId, setDeleteStatementId] = useState<string | null>(null);
  const [isMatchTxDialogOpen, setIsMatchTxDialogOpen] = useState(false);
  const [transactionToMatch, setTransactionToMatch] = useState<BankTransaction | null>(null);
  const [selectedMatchPaymentId, setSelectedMatchPaymentId] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState("");
  const [unmatchedSearch, setUnmatchedSearch] = useState("");
  const [matchSearch, setMatchSearch] = useState("");
  const [isBulkMatchDialogOpen, setIsBulkMatchDialogOpen] = useState(false);
  const [bulkMatchProgress, setBulkMatchProgress] = useState<{ current: number; total: number } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const { data: statements = [], isLoading: statementsLoading, refetch: refetchStatements } = useQuery<BankStatement[]>({
    queryKey: ["/api/admin/bank-statements", schoolId],
    queryFn: async () => {
      let url = "/api/admin/bank-statements";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch bank statements");
      return res.json();
    },
  });

  const { data: unmatchedTransactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<BankTransaction[]>({
    queryKey: ["/api/admin/bank-transactions/unmatched", schoolId],
    queryFn: async () => {
      let url = "/api/admin/bank-transactions/unmatched";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const [reconcileStatus, setReconcileStatus] = useState<"recorded" | "confirmed" | "reversed" | "all">("recorded");

  // Recorded-only dataset drives all matching mechanics (suggestions, bulk auto-match, match dialog).
  const { data: recordedPayments = [], isLoading: recordedPaymentsLoading, refetch: refetchRecordedPayments } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, "recorded"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "recorded");
      if (schoolId) params.set("schoolId", schoolId);
      const url = `/api/payments/records?${params.toString()}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch pending payments");
      return res.json();
    },
  });

  // Display dataset for the left column, switches with the status filter pills.
  // Skipped when the filter is "recorded" because it would duplicate the recordedPayments query above.
  const filteredEnabled = reconcileStatus !== "recorded";
  const { data: filteredPaymentsData = [], isLoading: filteredPaymentsLoadingRaw, refetch: refetchFilteredPayments } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, reconcileStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reconcileStatus !== "all") params.set("status", reconcileStatus);
      if (schoolId) params.set("schoolId", schoolId);
      const qs = params.toString();
      const url = `/api/payments/records${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: filteredEnabled,
  });

  const filteredPayments = filteredEnabled ? filteredPaymentsData : recordedPayments;
  const filteredPaymentsLoading = filteredEnabled ? filteredPaymentsLoadingRaw : recordedPaymentsLoading;

  // Backwards-compatible alias for downstream code (sidebar count, loading states, refetch buttons).
  const pendingPayments = recordedPayments;
  // Drive the left-column spinner from the dataset that actually feeds it so a
  // background refetch of the recorded dataset does not blank a non-recorded view.
  const paymentsLoading = filteredPaymentsLoading;
  const refetchPayments = () => {
    refetchRecordedPayments();
    if (filteredEnabled) refetchFilteredPayments();
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (schoolId) formData.append("schoolId", schoolId);

      const res = await apiRequest("/api/admin/bank-statements/upload", {
        method: "POST",
        body: formData,
      });
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: "Statement Uploaded",
        description: `Processed ${data.newTransactions} new transactions. ${data.duplicatesSkipped} duplicates skipped.`,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload bank statement",
        variant: "destructive",
      });
    },
  });

  const deleteStatementMutation = useMutation({
    mutationFn: async (statementId: string) => {
      const res = await apiRequest(`/api/admin/bank-statements/${statementId}`, {
        method: "DELETE",
      });
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: "Statement Deleted",
        description: `Removed statement and ${data.deletedTransactions} associated transactions.`,
      });
      setDeleteStatementId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete bank statement",
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, bankTransactionId }: { paymentId: string; bankTransactionId: string }) => {
      const res = await apiRequest(`/api/admin/payments/${paymentId}/confirm`, {
        method: "POST",
        body: { bankTransactionId },
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Payment Confirmed",
        description: "The payment has been matched and confirmed.",
      });
      setIsConfirmDialogOpen(false);
      setSelectedPayment(null);
      setSelectedTransaction(null);
      setMatchSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-broadsheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Confirmation Failed",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    },
  });

  const unconfirmMutation = useMutation({
    mutationFn: async ({ paymentId }: { paymentId: string }) => {
      const res = await apiRequest(`/api/admin/payments/${paymentId}/unconfirm`, {
        method: "POST",
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Payment Unconfirmed",
        description: "The payment is back in the pending list and the bank transaction is unmatched.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-broadsheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unconfirm Failed",
        description: error.message || "Failed to unconfirm payment",
        variant: "destructive",
      });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await apiRequest(`/api/admin/payments/${paymentId}/reverse`, {
        method: "POST",
        body: { reason },
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Payment Reversed",
        description: "The payment has been reversed successfully.",
      });
      setIsReverseDialogOpen(false);
      setSelectedPayment(null);
      setReversalReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-broadsheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reversal Failed",
        description: error.message || "Failed to reverse payment",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".pdf")) {
        toast({
          title: "Invalid File",
          description: "Please select a PDF, CSV, or Excel file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    uploadMutation.mutate(selectedFile, {
      onSettled: () => setIsUploading(false),
    });
  };

  const handleConfirmClick = (payment: FeePaymentRecordWithDetails) => {
    setSelectedPayment(payment);
    setSelectedTransaction(null);
    setMatchSearch("");
    setIsConfirmDialogOpen(true);
  };

  const handleReverseClick = (payment: FeePaymentRecordWithDetails) => {
    setSelectedPayment(payment);
    setIsReverseDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedPayment || !selectedTransaction) return;
    confirmMutation.mutate({
      paymentId: selectedPayment.id,
      bankTransactionId: selectedTransaction.id,
    });
  };

  const handleReversePayment = () => {
    if (!selectedPayment || !reversalReason.trim()) return;
    reverseMutation.mutate({
      paymentId: selectedPayment.id,
      reason: reversalReason,
    });
  };

  const runBulkAutoMatch = async () => {
    const items = highConfidenceCandidates;
    if (items.length === 0) return;
    setBulkMatchProgress({ current: 0, total: items.length });
    let succeeded = 0;
    const failed: Array<{ paymentId: string; reason: string }> = [];
    for (let i = 0; i < items.length; i++) {
      const { payment, transaction } = items[i];
      try {
        await apiRequest(`/api/admin/payments/${payment.id}/confirm`, {
          method: "POST",
          body: { bankTransactionId: transaction.id },
        });
        succeeded++;
      } catch (err: any) {
        failed.push({ paymentId: payment.id, reason: err?.message || "Unknown error" });
      }
      setBulkMatchProgress({ current: i + 1, total: items.length });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments/ledger"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-broadsheet"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-summary"] });
    toast({
      title: "Bulk Match Complete",
      description: failed.length === 0
        ? `Confirmed ${succeeded} payment${succeeded === 1 ? "" : "s"}.`
        : `Confirmed ${succeeded}, failed ${failed.length}. See console for details.`,
      variant: failed.length === 0 ? "default" : "destructive",
    });
    if (failed.length > 0) console.warn("Bulk auto-match failures:", failed);
    setBulkMatchProgress(null);
    setIsBulkMatchDialogOpen(false);
  };

  // Unified scorer used in both directions (payment->tx and tx->payment).
  // Returns 0 score when payment and tx are more than 1 calendar day apart.
  const scoreMatch = (
    payment: FeePaymentRecordWithDetails,
    tx: BankTransaction,
  ): { score: number; reasons: string[] } => {
    const dayDiff = calendarDayDiff(tx.transactionDate, payment.paymentDate);
    if (dayDiff > 1) return { score: 0, reasons: [] };

    const paymentAmount = parseFloat(payment.amount);
    const txAmount = parseFloat(tx.amount);
    if (isNaN(paymentAmount) || isNaN(txAmount)) return { score: 0, reasons: [] };
    let score = 0;
    const reasons: string[] = [];

    // Exact amount match (30 points). Moniepoint POS deducts ₦100 per
    // transaction, so a ₦5,000 payment lands as ₦4,900 in the bank statement.
    // For Moniepoint transactions, treat any difference of ≤ ₦100 as exact.
    const isMoniepoint = tx.bankFormat === 'moniepoint';
    const amountDiff = Math.abs(txAmount - paymentAmount);
    if (amountDiff < 0.01) {
      score += 30;
      reasons.push("Exact amount");
    } else if (isMoniepoint && amountDiff <= 100.01) {
      score += 30;
      reasons.push("Exact amount (±₦100 POS fee)");
    }

    // Date proximity: same day (30) or ±1 day (15)
    if (dayDiff === 0) {
      score += 30;
      reasons.push("Same day");
    } else {
      score += 15;
      reasons.push("±1 day");
    }

    // Depositor name — tiered scoring (only highest tier fires)
    const depositorName = (payment.depositorName || '').toLowerCase().trim();
    if (depositorName) {
      const txDesc = tx.rawDescription?.toLowerCase() || '';
      const depositorWords = depositorName.split(/\s+/).filter(w => w.length > 2);

      const allMatch = depositorWords.length > 0 && depositorWords.every(w => txDesc.includes(w));
      const prefixMatch = !allMatch && depositorWords.length > 0 &&
        depositorWords.every(w => {
          const prefix = w.substring(0, 5);
          return prefix.length >= 3 && txDesc.includes(prefix);
        });
      const longWordMatch = !allMatch && !prefixMatch &&
        depositorWords.some(w => w.length > 5 && txDesc.includes(w));
      const shortWordMatch = !allMatch && !prefixMatch && !longWordMatch &&
        depositorWords.some(w => w.length >= 3 && txDesc.includes(w));

      if (allMatch) {
        score += 40;
        reasons.push("Full depositor name match");
      } else if (prefixMatch) {
        score += 30;
        reasons.push("Partial depositor name match");
      } else if (longWordMatch) {
        score += 20;
        reasons.push("Depositor name word match");
      } else if (shortWordMatch) {
        score += 10;
        reasons.push("Depositor name partial");
      }
    }

    // Student name in description (20 points)
    const studentName = `${payment.student?.user?.lastName || ''} ${payment.student?.user?.firstName || ''}`.toLowerCase().trim();
    if (studentName && tx.rawDescription?.toLowerCase().includes(studentName.split(' ')[0])) {
      score += 20;
      reasons.push("Name match");
    }

    // Reference match — whole-word (50) or substring (35)
    if (payment.reference && payment.reference.length >= 5) {
      const refLower = payment.reference.toLowerCase();
      const descLower = tx.rawDescription?.toLowerCase() || '';
      const escapedRef = refLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wholeWordRegex = new RegExp(`(?<![a-z0-9])${escapedRef}(?![a-z0-9])`);
      if (wholeWordRegex.test(descLower)) {
        score += 50;
        reasons.push("Reference match");
      } else if (refLower.length >= 6 && descLower.includes(refLower)) {
        score += 35;
        reasons.push("Reference substring");
      }
    }

    return { score: Math.min(score, 100), reasons };
  };

  const findMatchingTransactions = (payment: FeePaymentRecordWithDetails) => {
    const paymentAmount = parseFloat(payment.amount);
    return unmatchedTransactions.filter((t) => {
      const txAmount = parseFloat(t.amount);
      // Moniepoint POS deducts a flat ₦100 fee, so the bank credit is ₦100
      // less than the recorded payment. Allow that gap for Moniepoint only.
      const tolerance = t.bankFormat === 'moniepoint' ? 100.01 : 0.01;
      if (Math.abs(txAmount - paymentAmount) >= tolerance) return false;
      return calendarDayDiff(t.transactionDate, payment.paymentDate) <= 1;
    });
  };

  // Memoized suggestion maps so we run the scorer once per data change,
  // not on every keystroke in the search inputs.
  const paymentSuggestions = useMemo(() => {
    const map = new Map<string, { transaction: BankTransaction | null; confidence: number; reasons: string[] }>();
    for (const p of pendingPayments) {
      let bestMatch: BankTransaction | null = null;
      let bestScore = 0;
      let bestReasons: string[] = [];
      for (const tx of unmatchedTransactions) {
        const { score, reasons } = scoreMatch(p, tx);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tx;
          bestReasons = reasons;
        }
      }
      map.set(p.id, { transaction: bestMatch, confidence: bestScore, reasons: bestReasons });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayments, unmatchedTransactions]);

  const paymentMatchableMap = useMemo(() => {
    const map = new Map<string, BankTransaction[]>();
    for (const p of pendingPayments) {
      map.set(p.id, findMatchingTransactions(p));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayments, unmatchedTransactions]);

  // Per-transaction list of payments that score >= 50 (medium+ confidence).
  const transactionSuggestions = useMemo(() => {
    const map = new Map<string, Array<{ payment: FeePaymentRecordWithDetails; score: number; reasons: string[] }>>();
    for (const tx of unmatchedTransactions) {
      const matches: Array<{ payment: FeePaymentRecordWithDetails; score: number; reasons: string[] }> = [];
      for (const p of pendingPayments) {
        const { score, reasons } = scoreMatch(p, tx);
        if (score >= 50) matches.push({ payment: p, score, reasons });
      }
      matches.sort((a, b) => b.score - a.score);
      map.set(tx.id, matches);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayments, unmatchedTransactions]);

  // Bulk auto-match candidates: payments with a >= 90% suggestion.
  const highConfidenceCandidates = useMemo(() => {
    const candidates: Array<{ payment: FeePaymentRecordWithDetails; transaction: BankTransaction; confidence: number }> = [];
    for (const p of pendingPayments) {
      const s = paymentSuggestions.get(p.id);
      if (s && s.transaction && s.confidence >= 90) {
        candidates.push({ payment: p, transaction: s.transaction, confidence: s.confidence });
      }
    }
    return candidates;
  }, [pendingPayments, paymentSuggestions]);

  const handleOpenMatchTxDialog = (tx: BankTransaction) => {
    setTransactionToMatch(tx);
    setSelectedMatchPaymentId(null);
    setIsMatchTxDialogOpen(true);
  };

  // Candidate recorded payments for the open Match-Transaction dialog:
  // unconfirmed payments with the SAME amount and date within ±1 day.
  const matchTxCandidates = useMemo(() => {
    if (!transactionToMatch) return [] as FeePaymentRecordWithDetails[];
    const txAmount = parseFloat(transactionToMatch.amount);
    if (isNaN(txAmount)) return [];
    // Moniepoint POS deducts a flat ₦100 fee, so a ₦4,900 bank credit can
    // legitimately match a ₦5,000 recorded payment. Allow that gap for
    // Moniepoint only; every other bank stays strict-equal.
    const tolerance = transactionToMatch.bankFormat === 'moniepoint' ? 100.01 : 0.01;
    return pendingPayments.filter((p) => {
      const pAmount = parseFloat(p.amount);
      if (isNaN(pAmount) || Math.abs(pAmount - txAmount) >= tolerance) return false;
      return calendarDayDiff(p.paymentDate, transactionToMatch.transactionDate) <= 1;
    });
  }, [transactionToMatch, pendingPayments]);

  const handleConfirmMatchTx = () => {
    if (!transactionToMatch || !selectedMatchPaymentId) return;
    confirmMutation.mutate(
      { paymentId: selectedMatchPaymentId, bankTransactionId: transactionToMatch.id },
      {
        onSuccess: () => {
          setIsMatchTxDialogOpen(false);
          setTransactionToMatch(null);
          setSelectedMatchPaymentId(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="reconcile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload Statements</TabsTrigger>
          <TabsTrigger value="reconcile">
            Reconcile Payments
            {pendingPayments.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingPayments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Unmatched
            {unmatchedTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unmatchedTransactions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bank Statement
              </CardTitle>
              <CardDescription>
                Upload PDF, CSV, or Excel bank statements to import transactions for matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileSelect}
                  className="max-w-xs mx-auto"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Accepts: PDF, Excel (.xlsx, .xls), CSV
                </p>
                {selectedFile && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="mt-4"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload & Process
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Expected columns: Date, Description, Amount (or Credit/Debit), Reference.
                  Duplicate transactions are automatically detected and skipped.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>Previously uploaded bank statements</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchStatements()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {statementsLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : statements.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No statements uploaded yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>New</TableHead>
                      <TableHead>Duplicates</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((statement) => (
                      <TableRow key={statement.id}>
                        <TableCell className="font-medium">
                          {statement.fileName}
                        </TableCell>
                        <TableCell>
                          {statement.dateRangeStart && statement.dateRangeEnd
                            ? `${formatRecoDate(statement.dateRangeStart)} - ${formatRecoDate(statement.dateRangeEnd)}`
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {statement.newTransactions || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            {statement.duplicatesSkipped || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRecoDate(statement.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteStatementId(statement.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconcile" className="space-y-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-medium">Payment Reconciliation</h4>
              <p className="text-sm text-muted-foreground">
                Match recorded payments with bank transactions side by side
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {highConfidenceCandidates.length > 0 && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setIsBulkMatchDialogOpen(true)}
                  data-testid="button-bulk-automatch"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-match {highConfidenceCandidates.length} High Confidence
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { refetchPayments(); refetchTransactions(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </Button>
            </div>
          </div>

          {(paymentsLoading || transactionsLoading) ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Recorded Payments */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b flex-wrap">
                  <h5 className="font-semibold text-blue-700">
                    {reconcileStatus === "recorded" ? "Recorded Payments"
                      : reconcileStatus === "confirmed" ? "Confirmed Payments"
                      : reconcileStatus === "reversed" ? "Reversed Payments"
                      : "All Payments"}
                  </h5>
                  <Badge variant="secondary">{filteredPayments.length}</Badge>
                  <div className="ml-auto flex gap-1 flex-wrap">
                    {(["recorded", "confirmed", "reversed", "all"] as const).map((s) => {
                      const labels: Record<typeof s, string> = {
                        recorded: "Pending",
                        confirmed: "Confirmed",
                        reversed: "Reversed",
                        all: "All",
                      };
                      return (
                        <Button
                          key={s}
                          size="sm"
                          variant={reconcileStatus === s ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={() => setReconcileStatus(s)}
                          data-testid={`button-reconcile-status-${s}`}
                        >
                          {labels[s]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                {filteredPayments.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">
                        {reconcileStatus === "recorded"
                          ? "No pending payments"
                          : reconcileStatus === "confirmed"
                            ? "No confirmed payments"
                            : reconcileStatus === "reversed"
                              ? "No reversed payments"
                              : "No payments"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {filteredPayments.map((payment) => {
                      const suggestion = paymentSuggestions.get(payment.id) || { transaction: null, confidence: 0, reasons: [] };
                      const matchingTxs = paymentMatchableMap.get(payment.id) || [];
                      
                      return (
                        <Card 
                          key={payment.id} 
                          className={`overflow-hidden transition-all ${
                            suggestion.confidence >= 80 
                              ? "border-green-300 bg-green-50/50" 
                              : suggestion.confidence >= 50 
                                ? "border-yellow-300 bg-yellow-50/50"
                                : ""
                          }`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap mb-1">
                                  <span className="font-medium text-sm truncate">
                                    {payment.student?.user?.lastName || 'Unknown'} {payment.student?.user?.firstName || ''}
                                  </span>
                                  <Badge variant="outline" className="text-xs">{payment.student?.studentId || 'N/A'}</Badge>
                                </div>
                                <div className="text-xl font-bold text-green-600">
                                  ₦{parseFloat(payment.amount).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatRecoDate(payment.paymentDate)}
                                  <Badge variant="secondary" className="text-xs ml-1">{payment.paymentMethod}</Badge>
                                </div>
                                {payment.reference && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Ref: {payment.reference}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                {payment.status === "recorded" && (
                                  <Button
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => handleConfirmClick(payment)}
                                    disabled={matchingTxs.length === 0}
                                  >
                                    <Link className="h-3 w-3 mr-1" />
                                    Match
                                  </Button>
                                )}
                                {payment.status === "confirmed" && (
                                  <>
                                    <Badge className="bg-green-600 hover:bg-green-600 text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Confirmed
                                    </Badge>
                                    {isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7"
                                        onClick={() => {
                                          if (window.confirm("Move this payment back to Pending and release the matched bank transaction?")) {
                                            unconfirmMutation.mutate({ paymentId: payment.id });
                                          }
                                        }}
                                        disabled={unconfirmMutation.isPending}
                                        data-testid={`button-unconfirm-${payment.id}`}
                                      >
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Unconfirm
                                      </Button>
                                    )}
                                  </>
                                )}
                                {payment.status === "reversed" && (
                                  <Badge variant="destructive" className="text-xs">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reversed
                                  </Badge>
                                )}
                                {payment.status !== "reversed" && isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 text-red-600 hover:text-red-700"
                                    onClick={() => handleReverseClick(payment)}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reverse
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Matched bank transaction (confirmed payments) */}
                            {payment.status === "confirmed" && payment.matchedTransaction && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-1 mb-1">
                                  <Link className="h-3 w-3 text-green-600" />
                                  <span className="text-xs font-medium text-green-700">Matched bank transaction</span>
                                </div>
                                <div className="text-xs bg-green-50 p-2 rounded border border-green-200">
                                  <div className="font-medium text-green-700">
                                    ₦{parseFloat(payment.matchedTransaction.amount).toLocaleString()}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {formatRecoDate(payment.matchedTransaction.transactionDate)}
                                    {payment.matchedTransaction.reference && ` | Ref: ${payment.matchedTransaction.reference}`}
                                  </div>
                                  {payment.matchedTransaction.rawDescription && (
                                    <div className="text-muted-foreground mt-0.5 break-words">
                                      {payment.matchedTransaction.rawDescription}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Reversal info */}
                            {payment.status === "reversed" && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-1 mb-1">
                                  <RotateCcw className="h-3 w-3 text-red-600" />
                                  <span className="text-xs font-medium text-red-700">Reversal</span>
                                </div>
                                <div className="text-xs bg-red-50 p-2 rounded border border-red-200 text-red-900">
                                  {payment.reversalReason || "No reason provided"}
                                </div>
                              </div>
                            )}

                            {/* Auto-suggest section */}
                            {payment.status === "recorded" && suggestion.transaction && suggestion.confidence >= 50 && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-1 mb-1">
                                  <Sparkles className={`h-3 w-3 ${suggestion.confidence >= 80 ? 'text-green-500' : 'text-yellow-500'}`} />
                                  <span className={`text-xs font-medium ${suggestion.confidence >= 80 ? 'text-green-700' : 'text-yellow-700'}`}>
                                    {suggestion.confidence >= 80 ? 'High Confidence Match' : 'Suggested Match'} ({suggestion.confidence}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs bg-white/80 p-2 rounded border">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-green-600">
                                      ₦{parseFloat(suggestion.transaction.amount).toLocaleString()}
                                    </div>
                                    <div className="text-muted-foreground">
                                      <span>{suggestion.transaction.rawDescription}</span>
                                      <div className="text-muted-foreground mt-0.5">
                                        {formatRecoDate(suggestion.transaction.transactionDate)}
                                        {suggestion.transaction.reference && ` | Ref: ${suggestion.transaction.reference}`}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Quick confirm only for high confidence matches (80%+) */}
                                  {suggestion.confidence >= 80 && (
                                    <Button
                                      size="sm"
                                      className="text-xs h-6 bg-green-600 hover:bg-green-700"
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setSelectedTransaction(suggestion.transaction);
                                        setMatchSearch("");
                                        setIsConfirmDialogOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Confirm
                                    </Button>
                                  )}
                                </div>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {suggestion.reasons.map((reason, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-white">
                                      {reason}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {payment.status === "recorded" && matchingTxs.length === 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-orange-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  No matching transactions within ±1 day
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Bank Transactions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h5 className="font-semibold text-purple-700">Bank Transactions</h5>
                  <Badge variant="secondary">{unmatchedTransactions.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search narration, reference or amount..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                {(() => {
                  const filteredTx = txSearch.trim()
                    ? unmatchedTransactions.filter((t) => {
                        const q = txSearch.toLowerCase();
                        return (
                          t.rawDescription?.toLowerCase().includes(q) ||
                          t.reference?.toLowerCase().includes(q) ||
                          t.amount?.toString().includes(q)
                        );
                      })
                    : unmatchedTransactions;
                  return filteredTx.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">{unmatchedTransactions.length === 0 ? "All transactions matched" : "No transactions match your search"}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {filteredTx.map((tx) => {
                      const scoredMatches = transactionSuggestions.get(tx.id) || [];
                      const topScore = scoredMatches[0]?.score || 0;
                      const cardClass = topScore >= 80
                        ? "border-green-300 bg-green-50/50"
                        : topScore >= 50
                          ? "border-yellow-300 bg-yellow-50/50"
                          : "";

                      return (
                        <Card 
                          key={tx.id} 
                          className={`overflow-hidden ${cardClass}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xl font-bold text-green-600">
                                  ₦{parseFloat(tx.amount).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatRecoDate(tx.transactionDate)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 break-words">
                                  {tx.rawDescription}
                                </div>
                                {tx.reference && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Ref: {tx.reference}
                                  </div>
                                )}
                              </div>
                              <div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => handleOpenMatchTxDialog(tx)}
                                >
                                  <Link className="h-3 w-3 mr-1" />
                                  Match
                                </Button>
                              </div>
                            </div>
                            
                            {scoredMatches.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-1 mb-1">
                                  <Sparkles className={`h-3 w-3 ${topScore >= 80 ? 'text-green-500' : 'text-yellow-500'}`} />
                                  <span className={`text-xs font-medium ${topScore >= 80 ? 'text-green-700' : 'text-yellow-700'}`}>
                                    {topScore >= 80 ? 'High Confidence Match' : 'Suggested Match'} ({topScore}%)
                                    {scoredMatches.length > 1 && ` — ${scoredMatches.length} candidates`}
                                  </span>
                                </div>
                                {scoredMatches.slice(0, 2).map(({ payment: p, score, reasons }) => (
                                  <div key={p.id} className="text-xs bg-white/80 p-2 rounded border mb-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium">
                                          {p.student?.user?.lastName || 'Unknown'} {p.student?.user?.firstName || ''}
                                        </span>
                                        <span className="text-muted-foreground ml-1">
                                          ({p.student?.studentId || 'N/A'})
                                        </span>
                                        <span className="text-muted-foreground ml-1">
                                          • ₦{parseFloat(p.amount).toLocaleString()} • {formatRecoDate(p.paymentDate)}
                                        </span>
                                      </div>
                                      <Badge variant="outline" className={`text-[10px] ${score >= 80 ? 'bg-green-50 text-green-700 border-green-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300'}`}>
                                        {score}%
                                      </Badge>
                                    </div>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {reasons.map((reason, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px] bg-white">
                                          {reason}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  );
                })()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-lg font-medium">Unmatched Transactions</h4>
              <p className="text-sm text-muted-foreground">
                Bank transactions not yet linked to any payment
              </p>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search description, reference..."
                  value={unmatchedSearch}
                  onChange={(e) => setUnmatchedSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchTransactions()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {transactionsLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : unmatchedTransactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-4 text-green-500" />
                <p>All transactions have been matched</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(unmatchedSearch.trim()
                      ? unmatchedTransactions.filter(tx => {
                          const q = unmatchedSearch.toLowerCase();
                          return (
                            tx.rawDescription?.toLowerCase().includes(q) ||
                            tx.reference?.toLowerCase().includes(q) ||
                            tx.amount?.toString().includes(q)
                          );
                        })
                      : unmatchedTransactions
                    ).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {formatRecoDate(tx.transactionDate)}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          ₦{parseFloat(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[300px] break-words text-sm">
                          {tx.rawDescription}
                        </TableCell>
                        <TableCell>{tx.reference || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            Unmatched
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenMatchTxDialog(tx)}
                          >
                            <Link className="h-3 w-3 mr-1" />
                            Match
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isConfirmDialogOpen} onOpenChange={(open) => { setIsConfirmDialogOpen(open); if (!open) setMatchSearch(""); }}>
        <DialogContent
          className="max-w-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Confirm Payment Match</DialogTitle>
            <DialogDescription>
              Select a bank transaction to match with this payment
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50 space-y-1">
                <p className="font-semibold">
                  {selectedPayment.student?.user?.lastName} {selectedPayment.student?.user?.firstName}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ₦{parseFloat(selectedPayment.amount).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedPayment.paymentMethod} | {formatRecoDate(selectedPayment.paymentDate)}
                </p>
                {selectedPayment.purpose && (
                  <p className="text-sm"><span className="font-medium">Purpose:</span> {selectedPayment.purpose}</p>
                )}
                {selectedPayment.depositorName && (
                  <p className="text-sm"><span className="font-medium">Depositor:</span> {selectedPayment.depositorName}</p>
                )}
                {selectedPayment.reference && (
                  <p className="text-sm"><span className="font-medium">Ref:</span> {selectedPayment.reference}</p>
                )}
              </div>

              <ArrowRight className="h-6 w-6 mx-auto text-muted-foreground" />

              <div className="space-y-2">
                <Label>Select Matching Transaction:</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description or reference..."
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-match-search"
                  />
                </div>
                {(() => {
                  const baseMatches = findMatchingTransactions(selectedPayment);
                  const q = matchSearch.trim().toLowerCase();
                  const filtered = q
                    ? baseMatches.filter(
                        (tx) =>
                          tx.rawDescription?.toLowerCase().includes(q) ||
                          tx.reference?.toLowerCase().includes(q),
                      )
                    : baseMatches;
                  if (baseMatches.length === 0) {
                    return (
                      <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                        No transactions match within ±1 day at this amount.
                      </div>
                    );
                  }
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                        No transactions match your search.
                      </div>
                    );
                  }
                  return (
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                      {filtered.map((tx) => (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTransaction(tx)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedTransaction?.id === tx.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">
                              ₦{parseFloat(tx.amount).toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatRecoDate(tx.transactionDate)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground break-words">
                            {tx.rawDescription}
                          </p>
                          {tx.reference && (
                            <p className="text-xs text-muted-foreground mt-1">Ref: {tx.reference}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsConfirmDialogOpen(false); setMatchSearch(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={!selectedTransaction || confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Match
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReverseDialogOpen} onOpenChange={setIsReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Payment</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The payment will be marked as reversed.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-red-50">
                <p className="font-medium mb-1">
                  {selectedPayment.student?.user?.lastName} {selectedPayment.student?.user?.firstName}
                </p>
                <p className="text-xl font-bold">
                  ₦{parseFloat(selectedPayment.amount).toLocaleString()}
                </p>
              </div>

              <div>
                <Label htmlFor="reversal-reason">Reason for Reversal</Label>
                <Textarea
                  id="reversal-reason"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this payment is being reversed..."
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReverseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReversePayment}
              disabled={!reversalReason.trim() || reverseMutation.isPending}
            >
              {reverseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reversing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reverse Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMatchTxDialogOpen}
        onOpenChange={(open) => {
          setIsMatchTxDialogOpen(open);
          if (!open) {
            setTransactionToMatch(null);
            setSelectedMatchPaymentId(null);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Match Recorded Payment</DialogTitle>
            <DialogDescription>
              Pick the recorded payment that this bank transaction settles. Only payments with the same amount within ±1 day are shown.
            </DialogDescription>
          </DialogHeader>

          {transactionToMatch && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      ₦{parseFloat(transactionToMatch.amount).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRecoDate(transactionToMatch.transactionDate)}
                    </p>
                  </div>
                  {transactionToMatch.reference && (
                    <Badge variant="outline" className="text-xs">
                      Ref: {transactionToMatch.reference}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 break-words">
                  {transactionToMatch.rawDescription}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Candidate Payments</Label>
                  <Badge variant="secondary">{matchTxCandidates.length}</Badge>
                </div>

                {matchTxCandidates.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                    <p>No matching recorded payments within ±1 day at this amount.</p>
                    <p className="text-xs mt-1">Record the payment first or check a wider date window.</p>
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto space-y-2 border rounded-lg p-2">
                    {matchTxCandidates.map((p) => {
                      const isSelected = selectedMatchPaymentId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedMatchPaymentId(p.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground"
                          }`}
                          data-testid={`match-candidate-${p.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-medium text-sm">
                                  {p.student?.user?.lastName || "Unknown"} {p.student?.user?.firstName || ""}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {p.student?.studentId || "N/A"}
                                </Badge>
                              </div>
                              <div className="text-lg font-bold text-green-600">
                                ₦{parseFloat(p.amount).toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 flex-wrap">
                                <Calendar className="h-3 w-3" />
                                {formatRecoDate(p.paymentDate)}
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {p.paymentMethod}
                                </Badge>
                              </div>
                              {p.depositorName && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Depositor: {p.depositorName}
                                </div>
                              )}
                              {p.reference && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Ref: {p.reference}
                                </div>
                              )}
                            </div>
                            <div
                              className={`h-4 w-4 rounded-full border-2 mt-1 flex-shrink-0 ${
                                isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMatchTxDialogOpen(false);
                setTransactionToMatch(null);
                setSelectedMatchPaymentId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMatchTx}
              disabled={!selectedMatchPaymentId || confirmMutation.isPending}
              data-testid="button-confirm-match-tx"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Match
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkMatchDialogOpen}
        onOpenChange={(open) => { if (!bulkMatchProgress) setIsBulkMatchDialogOpen(open); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Auto-match High Confidence Payments</DialogTitle>
            <DialogDescription>
              These payments have a confidence score of 90% or higher. Each will be confirmed individually with a full audit log entry. This cannot be undone in bulk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Payments</p>
                <p className="text-2xl font-bold">{highConfidenceCandidates.length}</p>
              </div>
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  ₦{highConfidenceCandidates.reduce((s, c) => s + parseFloat(c.payment.amount), 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
              {highConfidenceCandidates.map((c) => (
                <div key={c.payment.id} className="p-2 text-xs flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium">
                      {c.payment.student?.user?.lastName} {c.payment.student?.user?.firstName}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      ({c.payment.student?.studentId})
                    </span>
                  </div>
                  <span className="font-mono text-green-600">
                    ₦{parseFloat(c.payment.amount).toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300">
                    {c.confidence}%
                  </Badge>
                </div>
              ))}
            </div>
            {bulkMatchProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Confirming…</span>
                  <span>{bulkMatchProgress.current} / {bulkMatchProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-600 h-2 transition-all"
                    style={{ width: `${(bulkMatchProgress.current / bulkMatchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkMatchDialogOpen(false)}
              disabled={!!bulkMatchProgress}
            >
              Cancel
            </Button>
            <Button
              onClick={runBulkAutoMatch}
              disabled={!!bulkMatchProgress || highConfidenceCandidates.length === 0}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-bulk-automatch"
            >
              {bulkMatchProgress ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming…
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteStatementId} onOpenChange={(open) => { if (!open) setDeleteStatementId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank Statement</DialogTitle>
            <DialogDescription>
              This will permanently remove this statement and all its associated transactions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStatementId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteStatementId && deleteStatementMutation.mutate(deleteStatementId)}
              disabled={deleteStatementMutation.isPending}
            >
              {deleteStatementMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Statement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
