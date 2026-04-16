import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
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
  Plus,
  Sparkles,
  Calendar,
  Trash2,
  Search,
} from "lucide-react";
import type { FeePaymentRecordWithDetails, BankTransactionWithDetails } from "@shared/schema";

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

function sameCalendarDay(a: string | Date, b: string | Date): boolean {
  const da = typeof a === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a)
    ? (() => { const [y, m, d] = a.split("-").map(Number); return new Date(y, m - 1, d); })()
    : new Date(a);
  const db = typeof b === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b)
    ? (() => { const [y, m, d] = b.split("-").map(Number); return new Date(y, m - 1, d); })()
    : new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
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
}

interface PaymentReconciliationProps {
  schoolId?: string;
}

interface Student {
  id: string;
  studentId: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface Allocation {
  studentId: string;
  amount: number;
  term?: string;
  session?: string;
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
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [transactionToAllocate, setTransactionToAllocate] = useState<BankTransaction | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([{ studentId: "", amount: 0 }]);
  const [studentSearch, setStudentSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [unmatchedSearch, setUnmatchedSearch] = useState("");
  const [matchSearch, setMatchSearch] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: pendingPayments = [], isLoading: paymentsLoading, refetch: refetchPayments } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, "recorded"],
    queryFn: async () => {
      let url = "/api/payments/records?status=recorded";
      if (schoolId) url += `&schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch pending payments");
      return res.json();
    },
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/admin/students", schoolId],
    queryFn: async () => {
      let url = "/api/admin/students";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: isAllocateDialogOpen,
  });

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

  const allocationMutation = useMutation({
    mutationFn: async ({ transactionId, allocations }: { transactionId: string; allocations: Allocation[] }) => {
      const res = await apiRequest(`/api/admin/bank-transactions/${transactionId}/allocate`, {
        method: "POST",
        body: { allocations },
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Allocation Complete",
        description: "The transaction has been allocated to multiple students.",
      });
      setIsAllocateDialogOpen(false);
      setTransactionToAllocate(null);
      setAllocations([{ studentId: "", amount: 0 }]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-transactions/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-broadsheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-summary"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Allocation Failed",
        description: error.message || "Failed to allocate transaction",
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

  const findMatchingTransactions = (payment: FeePaymentRecordWithDetails) => {
    const paymentAmount = parseFloat(payment.amount);
    return unmatchedTransactions.filter((t) => {
      const txAmount = parseFloat(t.amount);
      if (Math.abs(txAmount - paymentAmount) >= 0.01) return false;
      return sameCalendarDay(t.transactionDate, payment.paymentDate);
    });
  };

  // Auto-suggest matching: find best matches based on amount and date
  const findSuggestedMatch = (payment: FeePaymentRecordWithDetails): { transaction: BankTransaction | null; confidence: number; reasons: string[] } => {
    const paymentAmount = parseFloat(payment.amount);
    const paymentDate = new Date(payment.paymentDate);
    const paymentYear = paymentDate.getFullYear();
    const paymentMonth = paymentDate.getMonth();
    const paymentDay = paymentDate.getDate();

    // Gate: only consider transactions from the exact same calendar day
    const sameDayCandidates = unmatchedTransactions.filter((t) => {
      const txDate = new Date(t.transactionDate);
      return (
        txDate.getFullYear() === paymentYear &&
        txDate.getMonth() === paymentMonth &&
        txDate.getDate() === paymentDay
      );
    });

    if (sameDayCandidates.length === 0) {
      return { transaction: null, confidence: 0, reasons: [] };
    }
    
    let bestMatch: BankTransaction | null = null;
    let bestScore = 0;
    let matchReasons: string[] = [];

    for (const tx of sameDayCandidates) {
      const txAmount = parseFloat(tx.amount);
      let score = 0;
      const reasons: string[] = [];

      // Exact amount match (30 points)
      if (Math.abs(txAmount - paymentAmount) < 0.01) {
        score += 30;
        reasons.push("Exact amount");
      }

      // Same day (always true for candidates — award points)
      score += 30;
      reasons.push("Same day");

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

      // Reference match (50 points — highly discriminating)
      // Only trigger when reference is at least 5 characters and matches as a whole word
      if (payment.reference && payment.reference.length >= 5) {
        const refLower = payment.reference.toLowerCase();
        const descLower = tx.rawDescription?.toLowerCase() || '';
        // Whole-word match: reference must be surrounded by word boundaries (non-alphanumeric chars or string edges)
        const escapedRef = refLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wholeWordRegex = new RegExp(`(?<![a-z0-9])${escapedRef}(?![a-z0-9])`);
        if (wholeWordRegex.test(descLower)) {
          score += 50;
          reasons.push("Reference match");
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = tx;
        matchReasons = reasons;
      }
    }

    // Only return a suggestion if we actually found a match (bestScore > 0 means at least one tx passed the date gate)
    if (!bestMatch) return { transaction: null, confidence: 0, reasons: [] };

    return { 
      transaction: bestMatch, 
      confidence: Math.min(bestScore, 100),
      reasons: matchReasons 
    };
  };

  const handleOpenAllocateDialog = (tx: BankTransaction) => {
    setTransactionToAllocate(tx);
    setAllocations([{ studentId: "", amount: 0 }]);
    setIsAllocateDialogOpen(true);
  };

  const addAllocation = () => {
    setAllocations([...allocations, { studentId: "", amount: 0 }]);
  };

  const removeAllocation = (index: number) => {
    if (allocations.length > 1) {
      setAllocations(allocations.filter((_, i) => i !== index));
    }
  };

  const updateAllocation = (index: number, field: keyof Allocation, value: string | number) => {
    const newAllocations = [...allocations];
    newAllocations[index] = { ...newAllocations[index], [field]: value };
    setAllocations(newAllocations);
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  };

  const handleSubmitAllocation = () => {
    if (!transactionToAllocate) return;
    const validAllocations = allocations.filter(a => a.studentId && a.amount > 0);
    if (validAllocations.length === 0) {
      toast({
        title: "Invalid Allocation",
        description: "Add at least one valid allocation with student and amount",
        variant: "destructive",
      });
      return;
    }
    allocationMutation.mutate({
      transactionId: transactionToAllocate.id,
      allocations: validAllocations,
    });
  };

  const filteredStudents = students.filter(s =>
    s.user?.lastName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.user?.firstName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(studentSearch.toLowerCase())
  );

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
            <div className="flex gap-2">
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
                <div className="flex items-center gap-2 pb-2 border-b">
                  <h5 className="font-semibold text-blue-700">Recorded Payments</h5>
                  <Badge variant="secondary">{pendingPayments.length}</Badge>
                </div>
                
                {pendingPayments.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No pending payments</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {pendingPayments.map((payment) => {
                      const suggestion = findSuggestedMatch(payment);
                      const matchingTxs = findMatchingTransactions(payment);
                      
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
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => handleConfirmClick(payment)}
                                  disabled={matchingTxs.length === 0}
                                >
                                  <Link className="h-3 w-3 mr-1" />
                                  Match
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-7 text-red-600 hover:text-red-700"
                                  onClick={() => handleReverseClick(payment)}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reverse
                                </Button>
                              </div>
                            </div>
                            
                            {/* Auto-suggest section */}
                            {suggestion.transaction && suggestion.confidence >= 50 && (
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
                            
                            {matchingTxs.length === 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-orange-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  No matching transactions found
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
                      // Check if any payment matches this transaction
                      const matchingPayments = pendingPayments.filter(p => 
                        Math.abs(parseFloat(p.amount) - parseFloat(tx.amount)) < 0.01
                      );
                      
                      return (
                        <Card 
                          key={tx.id} 
                          className={`overflow-hidden ${
                            matchingPayments.length > 0 
                              ? "border-blue-300 bg-blue-50/50" 
                              : ""
                          }`}
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
                                  onClick={() => handleOpenAllocateDialog(tx)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Allocate
                                </Button>
                              </div>
                            </div>
                            
                            {matchingPayments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <div className="flex items-center gap-1 mb-1">
                                  <Sparkles className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-700">
                                    {matchingPayments.length} matching payment{matchingPayments.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                                {matchingPayments.slice(0, 2).map(p => (
                                  <div key={p.id} className="text-xs bg-white/80 p-1 rounded border mb-1">
                                    <span className="font-medium">
                                      {p.student?.user?.lastName || 'Unknown'} {p.student?.user?.firstName || ''}
                                    </span>
                                    <span className="text-muted-foreground ml-1">
                                      ({p.student?.studentId || 'N/A'})
                                    </span>
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
                            onClick={() => handleOpenAllocateDialog(tx)}
                          >
                            Allocate
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
        <DialogContent className="max-w-2xl">
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
                        No transactions match on this date and amount.
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
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
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

      <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate Transaction to Students</DialogTitle>
            <DialogDescription>
              Split this bank transaction across multiple students
            </DialogDescription>
          </DialogHeader>

          {transactionToAllocate && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      ₦{parseFloat(transactionToAllocate.amount).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRecoDate(transactionToAllocate.transactionDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Allocated: ₦{getTotalAllocated().toLocaleString()}</p>
                    <p className={`text-xs ${
                      Math.abs(getTotalAllocated() - parseFloat(transactionToAllocate.amount)) < 0.01
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}>
                      {Math.abs(getTotalAllocated() - parseFloat(transactionToAllocate.amount)) < 0.01
                        ? "Fully allocated"
                        : `Remaining: ₦${(parseFloat(transactionToAllocate.amount) - getTotalAllocated()).toLocaleString()}`
                      }
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 break-words">
                  {transactionToAllocate.rawDescription}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Allocations</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAllocation}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Student
                  </Button>
                </div>

                {allocations.map((allocation, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                    <div className="col-span-6">
                      <Label className="text-xs">Student</Label>
                      <Select
                        value={allocation.studentId}
                        onValueChange={(val) => updateAllocation(index, "studentId", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select student..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Search students..."
                              value={studentSearch}
                              onChange={(e) => setStudentSearch(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          {filteredStudents.slice(0, 20).map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.user?.lastName} {student.user?.firstName} ({student.studentId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Amount (₦)</Label>
                      <Input
                        type="number"
                        value={allocation.amount || ""}
                        onChange={(e) => updateAllocation(index, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Term</Label>
                      <Select
                        value={allocation.term || ""}
                        onValueChange={(val) => updateAllocation(index, "term", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="First Term">First</SelectItem>
                          <SelectItem value="Second Term">Second</SelectItem>
                          <SelectItem value="Third Term">Third</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      {allocations.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAllocation(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAllocation}
              disabled={
                allocationMutation.isPending ||
                !transactionToAllocate ||
                Math.abs(getTotalAllocated() - parseFloat(transactionToAllocate?.amount || "0")) > 0.01
              }
            >
              {allocationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Allocating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Allocation
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
