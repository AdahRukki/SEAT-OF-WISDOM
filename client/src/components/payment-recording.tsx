import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  Loader2,
  X,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";
import { recordFeePaymentSchema, type FeePaymentRecordWithDetails, type FeePaymentStudentSplit, type FeeType } from "@shared/schema";

type RecordPaymentForm = z.infer<typeof recordFeePaymentSchema>;

const commonFieldsSchema = recordFeePaymentSchema.omit({ studentId: true, amount: true });
type CommonFields = z.infer<typeof commonFieldsSchema>;

const METHOD_LABELS: Record<string, string> = {
  transfer: "Bank Transfer",
  pos: "POS",
  cash: "Cash",
};

// Safe date formatter that avoids timezone off-by-one
function formatPaymentDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const s = typeof dateStr === "string" ? dateStr : dateStr.toISOString();
  const parsed = new Date(s.includes("T") ? s : `${s}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  const day = parsed.getDate().toString().padStart(2, "0");
  const month = parsed.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

interface Student {
  id: string;
  studentId: string;
  firstName?: string;
  lastName?: string;
  className?: string;
  classId?: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

interface SchoolClass {
  id: string;
  name: string;
}

interface SelectedStudentEntry {
  student: Student;
  amount: number;
}

interface PaymentRecordingProps {
  schoolId?: string;
  currentTerm?: string;
  currentSession?: string;
  userRole: "admin" | "sub-admin" | "bursar";
}

export function PaymentRecording({
  schoolId,
  currentTerm,
  currentSession,
  userRole,
}: PaymentRecordingProps) {
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<SelectedStudentEntry[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customPurpose, setCustomPurpose] = useState("");
  const [classSortDir, setClassSortDir] = useState<"asc" | "desc" | null>(null);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTerm, setFilterTerm] = useState<string>(currentTerm || "");
  const [filterSession, setFilterSession] = useState<string>(currentSession || "");
  const [viewingRecord, setViewingRecord] = useState<FeePaymentRecordWithDetails | null>(null);
  const PAGE_SIZE = 25;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (currentTerm) setFilterTerm(currentTerm);
  }, [currentTerm]);

  useEffect(() => {
    if (currentSession) setFilterSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const saved = localStorage.getItem("pendingPayments");
    if (saved) {
      const loaded = JSON.parse(saved);
      setPendingPayments(loaded);
      if (navigator.onLine && loaded.length > 0) {
        syncPendingPayments();
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pendingPayments", JSON.stringify(pendingPayments));
  }, [pendingPayments]);

  useEffect(() => {
    if (isOnline && pendingPayments.length > 0) {
      syncPendingPayments();
    }
  }, [isOnline]);

  const { data: academicSessions = [] } = useQuery<{ id: string; sessionYear: string }[]>({
    queryKey: ["/api/admin/academic-sessions"],
  });

  const sessionOptions: string[] = academicSessions.length > 0
    ? academicSessions.map((s) => s.sessionYear)
    : (() => {
        const base = currentSession
          ? parseInt(currentSession.split("/")[0]) || new Date().getFullYear()
          : new Date().getFullYear();
        return [`${base - 1}/${base}`, `${base}/${base + 1}`, `${base + 1}/${base + 2}`];
      })();

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/admin/students", schoolId],
    enabled: !!schoolId,
  });

  const { data: schoolClasses = [] } = useQuery<SchoolClass[]>({
    queryKey: ["/api/admin/classes", schoolId],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = schoolId ? `/api/admin/classes?schoolId=${schoolId}` : `/api/admin/classes`;
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
    enabled: !!schoolId,
  });

  const { data: feeTypesData = [] } = useQuery<FeeType[]>({
    queryKey: ["/api/admin/fee-types", schoolId],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = schoolId ? `/api/admin/fee-types?schoolId=${schoolId}` : `/api/admin/fee-types`;
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!schoolId,
  });

  const tuitionFeeType = feeTypesData.find(ft => ft.isTuition);

  const { data: tuitionAmounts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tuition-amounts", tuitionFeeType?.id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/tuition-amounts/${tuitionFeeType!.id}`, { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tuitionFeeType?.id,
  });

  // Fix #1: memoize so the Map reference is stable across renders
  const tuitionAmountMap = useMemo(
    () => new Map(tuitionAmounts.map((ta: any) => [ta.classId, Number(ta.amount)])),
    [tuitionAmounts]
  );

  const { data: paymentRecords = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, statusFilter, dateFrom, dateTo, filterTerm, filterSession],
    queryFn: async () => {
      let url = "/api/payments/records?";
      if (schoolId) url += `schoolId=${schoolId}&`;
      if (statusFilter && statusFilter !== "all") url += `status=${statusFilter}&`;
      if (dateFrom) url += `startDate=${dateFrom}&`;
      if (dateTo) url += `endDate=${dateTo}&`;
      if (filterTerm) url += `term=${encodeURIComponent(filterTerm)}&`;
      if (filterSession) url += `session=${encodeURIComponent(filterSession)}&`;
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch payment records");
      return res.json();
    },
  });

  const form = useForm<CommonFields>({
    resolver: zodResolver(commonFieldsSchema),
    defaultValues: {
      paymentMethod: "cash",
      paymentDate: new Date().toISOString().split("T")[0],
      purpose: "",
      depositorName: "",
      reference: "",
      term: currentTerm || "",
      session: currentSession || "",
      notes: "",
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: RecordPaymentForm) => {
      const res = await apiRequest("/api/payments/record", { method: "POST", body: data });
      return res;
    },
  });

  const syncPendingPayments = async () => {
    const toSync = [...pendingPayments];
    const failed: any[] = [];

    for (const payment of toSync) {
      try {
        await apiRequest("/api/payments/record", { method: "POST", body: payment });
      } catch {
        failed.push(payment);
      }
    }

    setPendingPayments(failed);

    if (failed.length === 0) {
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${toSync.length} pending payment(s).`,
      });
    } else {
      toast({
        title: "Partial Sync",
        description: `${toSync.length - failed.length} synced, ${failed.length} failed.`,
        variant: "destructive",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
  };

  const currentPurpose = form.watch("purpose");

  // Fix #1b: only overwrite amounts that are still 0 (preserve user-typed values)
  useEffect(() => {
    if (!currentPurpose || selectedEntries.length === 0) return;
    const matchedFee = feeTypesData.find(ft => ft.name === currentPurpose);
    if (matchedFee?.isTuition) {
      setSelectedEntries(prev => prev.map(e => {
        if (e.amount > 0) return e;
        const rate = e.student.classId ? (tuitionAmountMap.get(e.student.classId) || 0) : 0;
        return { ...e, amount: rate };
      }));
      const sum = selectedEntries.reduce((acc, e) => {
        return acc + (tuitionAmountMap.get(e.student.classId || '') || 0);
      }, 0);
      if (sum > 0) setTotalAmount(sum);
    }
  }, [selectedEntries.length, currentPurpose, feeTypesData, tuitionAmountMap]);

  // Allocation tally
  const studentCount = selectedEntries.length;
  const allocatedTotal = selectedEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const unallocated = totalAmount - allocatedTotal;

  const onSubmit = async (commonData: CommonFields) => {
    if (selectedEntries.length === 0) {
      toast({
        title: "No Students Selected",
        description: "Please add at least one student before recording a payment.",
        variant: "destructive",
      });
      return;
    }

    if (!totalAmount || totalAmount <= 0) {
      toast({
        title: "Missing Amount",
        description: "Please enter a total amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    // Fix #5: validate custom purpose description
    if (commonData.purpose === "Other" && !customPurpose.trim()) {
      toast({
        title: "Purpose Required",
        description: 'Please describe the payment purpose when selecting "Other".',
        variant: "destructive",
      });
      return;
    }

    // Fix #2: skip per-student amount checks for single student
    if (studentCount > 1) {
      const hasZeroAmount = selectedEntries.some(e => !e.amount || e.amount <= 0);
      if (hasZeroAmount) {
        toast({
          title: "Missing Amount",
          description: "Please enter an amount for each student.",
          variant: "destructive",
        });
        return;
      }

      if (allocatedTotal !== totalAmount) {
        toast({
          title: "Allocation Mismatch",
          description: `Allocated amounts (₦${allocatedTotal.toLocaleString()}) do not match the total (₦${totalAmount.toLocaleString()}).`,
          variant: "destructive",
        });
        return;
      }
    }

    const resolvedPurpose = commonData.purpose === "Other" ? customPurpose.trim() : commonData.purpose;
    const dataWithPurpose = { ...commonData, purpose: resolvedPurpose };

    if (!isOnline) {
      if (studentCount > 1) {
        // Multi-student payments must be online — they require a single atomic DB record
        toast({
          title: "Connection Required",
          description: "Split payments for multiple students require an internet connection. Please reconnect and try again.",
          variant: "destructive",
        });
        return;
      }
      // Single-student offline flow
      const offlinePayments = selectedEntries.map((entry) => ({
        ...dataWithPurpose,
        studentId: entry.student.id,
        amount: totalAmount,
        offlineId: `offline_${Date.now()}_${entry.student.id}`,
        createdAt: new Date().toISOString(),
      }));
      setPendingPayments([...pendingPayments, ...offlinePayments]);
      toast({
        title: "Payment Saved Offline",
        description: "Payment will be synced when you're back online.",
      });
      closeAndReset();
      return;
    }

    setIsSubmitting(true);

    try {
      if (studentCount > 1) {
        // Multi-student: send a single request with splits
        await apiRequest("/api/payments/records/multi", {
          method: "POST",
          body: {
            ...dataWithPurpose,
            schoolId: schoolId,
            amount: totalAmount,
            entries: selectedEntries.map(e => ({ studentId: e.student.id, amount: e.amount })),
          },
        });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
        toast({
          title: "Payment Recorded",
          description: `Split payment of ₦${totalAmount.toLocaleString()} recorded for ${studentCount} students.`,
        });
        closeAndReset();
      } else {
        // Single student
        const entry = selectedEntries[0];
        await recordPaymentMutation.mutateAsync({
          ...dataWithPurpose,
          studentId: entry.student.id,
          amount: totalAmount,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
        toast({
          title: "Payment Recorded",
          description: `Payment of ₦${totalAmount.toLocaleString()} recorded successfully.`,
        });
        closeAndReset();
      }
    } catch (err: any) {
      toast({
        title: "Payment Failed",
        description: err.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    }

    setIsSubmitting(false);
  };

  const closeAndReset = () => {
    setIsRecordDialogOpen(false);
    setSelectedEntries([]);
    setTotalAmount(0);
    setSearchQuery("");
    setClassFilter("all");
    setCustomPurpose("");
    form.reset({
      paymentMethod: "cash",
      paymentDate: new Date().toISOString().split("T")[0],
      purpose: "",
      depositorName: "",
      reference: "",
      term: currentTerm || "",
      session: currentSession || "",
      notes: "",
    });
  };

  const addStudent = (student: Student) => {
    if (selectedEntries.some((e) => e.student.id === student.id)) return;
    setSelectedEntries([...selectedEntries, { student, amount: 0 }]);
    setSearchQuery("");
  };

  const updateStudentAmount = (studentId: string, amount: number) => {
    setSelectedEntries(prev =>
      prev.map(e => e.student.id === studentId ? { ...e, amount } : e)
    );
  };

  const removeStudent = (studentId: string) => {
    setSelectedEntries(selectedEntries.filter((e) => e.student.id !== studentId));
  };

  const selectedIds = new Set(selectedEntries.map((e) => e.student.id));

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim() && classFilter === "all") return false;
    if (selectedIds.has(s.id)) return false;
    if (classFilter !== "all" && s.classId !== classFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const firstName = (s.user?.firstName || s.firstName || '').toLowerCase();
    const lastName = (s.user?.lastName || s.lastName || '').toLowerCase();
    const studentId = (s.studentId || '').toLowerCase();
    return firstName.includes(query) || lastName.includes(query) || studentId.includes(query);
  });

  const toggleClassSort = () => {
    setClassSortDir((prev) => prev === null ? "asc" : prev === "asc" ? "desc" : null);
  };

  const sortedRecords = [...paymentRecords].sort((a, b) => {
    if (!classSortDir) return 0;
    const nameA = (a.student?.class?.name || "").toLowerCase();
    const nameB = (b.student?.class?.name || "").toLowerCase();
    if (nameA < nameB) return classSortDir === "asc" ? -1 : 1;
    if (nameA > nameB) return classSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const nameFilteredRecords = nameSearch.trim()
    ? sortedRecords.filter((r) => {
        const q = nameSearch.toLowerCase();
        return (
          r.student?.user?.lastName?.toLowerCase().includes(q) ||
          r.student?.user?.firstName?.toLowerCase().includes(q) ||
          r.student?.studentId?.toLowerCase().includes(q)
        );
      })
    : sortedRecords;

  const totalRecords = nameFilteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = nameFilteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = totalRecords === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRecords);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recorded":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Confirmed</Badge>;
      case "reversed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Reversed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Payment Recording</h3>
          <p className="text-sm text-muted-foreground">
            Record student fee payments for verification and reconciliation
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendingPayments.length > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              <Clock className="h-3 w-3 mr-1" />
              {pendingPayments.length} pending sync
            </Badge>
          )}
          <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3" /> Online
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" /> Offline
              </>
            )}
          </Badge>
          <Dialog open={isRecordDialogOpen} onOpenChange={(open) => { if (!open) closeAndReset(); else setIsRecordDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Fee Payment</DialogTitle>
                {/* UX #1: description matches actual form order */}
                <DialogDescription>
                  Add students, select a purpose, then confirm the amount(s).
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* Student Search */}
                  <div className="space-y-2">
                    <Label>Add Students</Label>
                    <div className="flex gap-2">
                      {/* UX #4: clear search when switching class filter */}
                      <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setSearchQuery(""); }}>
                        <SelectTrigger className="w-[160px] flex-shrink-0" aria-label="Filter by class">
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {schoolClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    {(searchQuery.trim() || classFilter !== "all") && (
                      <div className="max-h-[160px] overflow-y-auto border rounded-md">
                        {studentsLoading ? (
                          <div className="p-4 text-center text-muted-foreground">Loading students...</div>
                        ) : filteredStudents.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">No students found</div>
                        ) : (
                          <>
                            {/* UX #2: show hint when results are capped */}
                            {filteredStudents.length > 10 && (
                              <div className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/30 sticky top-0">
                                Showing 10 of {filteredStudents.length} — type a name to narrow down
                              </div>
                            )}
                            {filteredStudents.slice(0, 10).map((student) => (
                              <div
                                key={student.id}
                                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 flex items-center justify-between"
                                onClick={() => addStudent(student)}
                              >
                                <div>
                                  <div className="font-medium text-sm">
                                    {student.user?.lastName || student.lastName} {student.user?.firstName || student.firstName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ID: {student.studentId} | {student.className || "N/A"}
                                  </div>
                                </div>
                                <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* UX #1: Purpose moved above Total Amount so tuition auto-fill is immediately visible */}
                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose</FormLabel>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          if (val !== "Other") setCustomPurpose("");
                        }} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="What is this payment for?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {feeTypesData.filter(ft => ft.isActive).map((ft) => (
                              <SelectItem key={ft.id} value={ft.name}>
                                {ft.name}{ft.isTuition ? " (Tuition)" : ""}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {field.value === "Other" && (
                          <Input
                            placeholder="Describe the payment purpose..."
                            value={customPurpose}
                            onChange={(e) => setCustomPurpose(e.target.value.slice(0, 100))}
                            maxLength={100}
                            className="mt-2"
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Total Amount */}
                  <div className="space-y-2">
                    <Label>Total Amount (₦)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="pl-7"
                        value={totalAmount || ""}
                        onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Selected Students List */}
                  {selectedEntries.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label>{selectedEntries.length} student{selectedEntries.length > 1 ? "s" : ""} selected</Label>
                        {studentCount > 1 && (
                          <span className="text-xs text-muted-foreground ml-auto">Each gets a separate payment record</span>
                        )}
                      </div>
                      <div className="border rounded-md divide-y">
                        {selectedEntries.map((entry) => (
                          <div key={entry.student.id} className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {entry.student.user?.lastName || entry.student.lastName} {entry.student.user?.firstName || entry.student.firstName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {entry.student.studentId} | {entry.student.className || "N/A"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Fix #2a: single student shows read-only amount from totalAmount */}
                              {studentCount === 1 ? (
                                <span className="text-sm font-medium w-28 text-right pr-2">
                                  {totalAmount > 0 ? `₦${totalAmount.toLocaleString()}` : "—"}
                                </span>
                              ) : (
                                <div className="relative w-28">
                                  <span className="absolute left-2.5 top-2 text-sm text-muted-foreground">₦</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    className="pl-6 h-8 text-sm"
                                    value={entry.amount || ""}
                                    onChange={(e) => updateStudentAmount(entry.student.id, parseFloat(e.target.value) || 0)}
                                    onFocus={(e) => e.target.select()}
                                  />
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-red-500"
                                onClick={() => removeStudent(entry.student.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Fix #2b: hide allocation strip for single student */}
                      {totalAmount > 0 && studentCount > 1 && (
                        <div className={`text-xs rounded p-2 ${
                          unallocated === 0
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : unallocated > 0
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          ₦{allocatedTotal.toLocaleString()} allocated of ₦{totalAmount.toLocaleString()} total
                          {unallocated > 0 && ` — ₦${unallocated.toLocaleString()} remaining`}
                          {unallocated < 0 && ` — ₦${Math.abs(unallocated).toLocaleString()} over total`}
                          {unallocated === 0 && " ✓ Fully allocated"}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Term & Session are auto-filled from currently active academic info */}

                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="transfer">Bank Transfer</SelectItem>
                              <SelectItem value="pos">POS</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="depositorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depositor Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of person who made the deposit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Transaction reference / POS slip code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any additional notes about this payment..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeAndReset}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isSubmitting || selectedEntries.length === 0}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Recording...
                        </>
                      ) : isOnline ? (
                        selectedEntries.length > 1
                          ? `Record ${selectedEntries.length} Payments`
                          : "Record Payment"
                      ) : (
                        "Save Offline"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Term:</Label>
            <Select value={filterTerm || "__all__"} onValueChange={(v) => { setFilterTerm(v === "__all__" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Terms</SelectItem>
                <SelectItem value="First Term">First Term</SelectItem>
                <SelectItem value="Second Term">Second Term</SelectItem>
                <SelectItem value="Third Term">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Session:</Label>
            <Select value={filterSession || "__all__"} onValueChange={(v) => { setFilterSession(v === "__all__" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sessions</SelectItem>
                {sessionOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Status:</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="recorded">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">From:</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">To:</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-[150px]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1); }}>
              Clear dates
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student name or ID..."
              value={nameSearch}
              onChange={(e) => { setNameSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8 w-[200px]"
            />
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => refetchRecords()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {pendingPayments.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
            {pendingPayments.length} offline payment(s) syncing when connected…
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground text-left font-medium"
                      onClick={toggleClassSort}
                      type="button"
                      title={classSortDir === null ? "Sort by class A→Z" : classSortDir === "asc" ? "Sort by class Z→A" : "Clear class sort"}
                    >
                      Class
                      {classSortDir === null && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      {classSortDir === "asc" && <ArrowUp className="h-3 w-3 text-primary" />}
                      {classSortDir === "desc" && <ArrowDown className="h-3 w-3 text-primary" />}
                    </button>
                  </TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Purpose</TableHead>
                  {/* Fix #3: Method column now uses proper labels */}
                  <TableHead>Method</TableHead>
                  {/* Fix #4: Reference column added */}
                  <TableHead>Reference</TableHead>
                  <TableHead>Term/Session</TableHead>
                  <TableHead>Status</TableHead>
                  {/* UX #5: Depositor in own column */}
                  <TableHead>Depositor</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : totalRecords === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No payment records found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      {/* Fix #6: date parsed with local-time anchor to avoid off-by-one */}
                      <TableCell className="text-sm">
                        {formatPaymentDate(record.paymentDate)}
                      </TableCell>
                      <TableCell>
                        {record.student ? (
                          <>
                            <div className="font-medium text-sm">
                              {record.student.user?.lastName} {record.student.user?.firstName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.student.studentId}
                            </div>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Split: {record.splitCount ?? "N"} students
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.student?.class?.name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{parseFloat(record.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.purpose || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Fix #3: use METHOD_LABELS lookup instead of CSS capitalize */}
                      <TableCell className="text-sm">
                        {METHOD_LABELS[record.paymentMethod] ?? record.paymentMethod}
                      </TableCell>
                      {/* Fix #4: reference column */}
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {record.reference || <span className="not-italic font-sans">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.term} / {record.session}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      {/* UX #5: depositor moved from Student cell to own column */}
                      <TableCell className="text-sm text-muted-foreground">
                        {record.depositorName || <span>—</span>}
                      </TableCell>
                      {/* UX #6: fallback for missing recorded-by user */}
                      <TableCell className="text-sm text-muted-foreground">
                        {record.recordedByUser
                          ? `${record.recordedByUser.firstName} ${record.recordedByUser.lastName}`.trim()
                          : <span>—</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewingRecord(record)}
                          title="View details"
                          data-testid={`button-view-payment-${record.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalRecords > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {showingFrom}–{showingTo} of {totalRecords}
            </p>
            {totalRecords > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentDetailsDialog
        record={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />
    </div>
  );
}

function PaymentDetailsDialog({
  record,
  onClose,
}: {
  record: FeePaymentRecordWithDetails | null;
  onClose: () => void;
}) {
  const isSplit = !!record && !record.student;

  const { data: splits, isLoading: splitsLoading } = useQuery<
    (FeePaymentStudentSplit & {
      student?: { studentId: string; user?: { firstName: string; lastName: string }; class?: { name: string } };
    })[]
  >({
    queryKey: ["/api/payments/records", record?.id, "splits"],
    enabled: !!record && isSplit,
  });

  if (!record) return null;

  const dateStr = formatPaymentDate(record.paymentDate);
  const statusLabel =
    record.status === "confirmed" ? "Confirmed" : record.status === "reversed" ? "Reversed" : "Pending";

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>Full information for this payment record.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <DetailRow label="Date" value={dateStr} />
          <DetailRow label="Amount" value={`₦${parseFloat(record.amount).toLocaleString()}`} bold />
          <DetailRow label="Purpose" value={record.purpose || "—"} />
          <DetailRow label="Method" value={METHOD_LABELS[record.paymentMethod] ?? record.paymentMethod} />
          <DetailRow label="Reference" value={record.reference || "—"} mono />
          <DetailRow label="Term / Session" value={`${record.term || "—"} / ${record.session || "—"}`} />
          <DetailRow label="Status" value={statusLabel} />
          <DetailRow label="Depositor" value={record.depositorName || "—"} />
          <DetailRow
            label="Recorded By"
            value={
              record.recordedByUser
                ? `${record.recordedByUser.firstName} ${record.recordedByUser.lastName}`.trim()
                : "—"
            }
          />
          {record.notes && <DetailRow label="Notes" value={record.notes} />}

          <Separator />

          {record.student ? (
            <>
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Student</div>
              <div className="border rounded-md p-3">
                <div className="font-medium">
                  {record.student.user?.lastName} {record.student.user?.firstName}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {record.student.studentId} · {record.student.class?.name || "No class"}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Split Between Students</div>
                <Badge variant="secondary" className="text-xs">
                  {splits?.length ?? record.splitCount ?? "…"} students
                </Badge>
              </div>
              {splitsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : splits && splits.length > 0 ? (
                <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                  {splits.map((s) => (
                    <div key={s.id} className="p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {s.student?.user?.lastName} {s.student?.user?.firstName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.student?.studentId || "—"} · {s.student?.class?.name || "No class"}
                        </div>
                      </div>
                      <div className="font-medium text-sm flex-shrink-0 pl-3">
                        ₦{parseFloat(s.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No split details available.</div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${bold ? "font-semibold" : ""} ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

