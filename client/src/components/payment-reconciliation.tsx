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
} from "lucide-react";
import type { FeePaymentRecordWithDetails, BankTransactionWithDetails } from "@shared/schema";

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
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [transactionToAllocate, setTransactionToAllocate] = useState<BankTransaction | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([{ studentId: "", amount: 0 }]);
  const [studentSearch, setStudentSearch] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statements = [], isLoading: statementsLoading, refetch: refetchStatements } = useQuery<BankStatement[]>({
    queryKey: ["/api/admin/bank-statements", schoolId],
    queryFn: async () => {
      let url = "/api/admin/bank-statements";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bank statements");
      return res.json();
    },
  });

  const { data: unmatchedTransactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<BankTransaction[]>({
    queryKey: ["/api/admin/bank-transactions/unmatched", schoolId],
    queryFn: async () => {
      let url = "/api/admin/bank-transactions/unmatched";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const { data: pendingPayments = [], isLoading: paymentsLoading, refetch: refetchPayments } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, "recorded"],
    queryFn: async () => {
      let url = "/api/payments/records?status=recorded";
      if (schoolId) url += `&schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending payments");
      return res.json();
    },
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/admin/students", schoolId],
    queryFn: async () => {
      let url = "/api/admin/students";
      if (schoolId) url += `?schoolId=${schoolId}`;
      const res = await fetch(url, { credentials: "include" });
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
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV or Excel file",
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
      return Math.abs(txAmount - paymentAmount) < 0.01;
    });
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
                Upload CSV or Excel files from your bank to import transactions for matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="max-w-xs mx-auto"
                />
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
                            ? `${new Date(statement.dateRangeStart).toLocaleDateString()} - ${new Date(statement.dateRangeEnd).toLocaleDateString()}`
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
                          {statement.createdAt
                            ? new Date(statement.createdAt).toLocaleDateString()
                            : "N/A"}
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
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-medium">Pending Payments</h4>
              <p className="text-sm text-muted-foreground">
                Match recorded payments with bank transactions to confirm
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchPayments()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {paymentsLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : pendingPayments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-4 text-green-500" />
                <p>No pending payments to reconcile</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingPayments.map((payment) => {
                const matchingTxs = findMatchingTransactions(payment);
                return (
                  <Card key={payment.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">
                              {payment.student?.user?.lastName} {payment.student?.user?.firstName}
                            </span>
                            <Badge variant="outline">{payment.student?.studentId}</Badge>
                            <Badge variant="secondary">{payment.paymentMethod}</Badge>
                          </div>
                          <div className="text-2xl font-bold text-green-600 mb-2">
                            ₦{parseFloat(payment.amount).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span>Date: {new Date(payment.paymentDate).toLocaleDateString()}</span>
                            {payment.reference && <span> | Ref: {payment.reference}</span>}
                            {payment.term && <span> | {payment.term}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmClick(payment)}
                            disabled={matchingTxs.length === 0}
                          >
                            <Link className="h-4 w-4 mr-2" />
                            Match & Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReverseClick(payment)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reverse
                          </Button>
                        </div>
                      </div>
                      {matchingTxs.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-2">
                            Potential Matches ({matchingTxs.length}):
                          </p>
                          <div className="space-y-2">
                            {matchingTxs.slice(0, 3).map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                              >
                                <div>
                                  <span className="font-medium">
                                    ₦{parseFloat(tx.amount).toLocaleString()}
                                  </span>
                                  <span className="text-muted-foreground ml-2">
                                    {new Date(tx.transactionDate).toLocaleDateString()}
                                  </span>
                                </div>
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {tx.rawDescription}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {matchingTxs.length === 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-orange-600 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            No matching bank transactions found for this amount
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-medium">Unmatched Transactions</h4>
              <p className="text-sm text-muted-foreground">
                Bank transactions not yet linked to any payment
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchTransactions()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
                    {unmatchedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {new Date(tx.transactionDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          ₦{parseFloat(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
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

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Payment Match</DialogTitle>
            <DialogDescription>
              Select a bank transaction to match with this payment
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="font-medium mb-1">
                  {selectedPayment.student?.user?.lastName} {selectedPayment.student?.user?.firstName}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ₦{parseFloat(selectedPayment.amount).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedPayment.paymentMethod} | {new Date(selectedPayment.paymentDate).toLocaleDateString()}
                </p>
              </div>

              <ArrowRight className="h-6 w-6 mx-auto text-muted-foreground" />

              <div className="space-y-2">
                <Label>Select Matching Transaction:</Label>
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {findMatchingTransactions(selectedPayment).map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTransaction?.id === tx.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          ₦{parseFloat(tx.amount).toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(tx.transactionDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {tx.rawDescription}
                      </p>
                    </div>
                  ))}
                </div>
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
                      {new Date(transactionToAllocate.transactionDate).toLocaleDateString()}
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
                <p className="text-sm text-muted-foreground mt-2 truncate">
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
    </div>
  );
}
