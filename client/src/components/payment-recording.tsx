import { useState, useEffect } from "react";
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
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  X,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { recordFeePaymentSchema, type FeePaymentRecordWithDetails } from "@shared/schema";

type RecordPaymentForm = z.infer<typeof recordFeePaymentSchema>;

const PAYMENT_PURPOSES = [
  "Tuition Fee",
  "Uniform",
  "Books / Stationery",
  "Excursion",
  "Development Levy",
  "PTA Fee",
  "Exam Fee",
  "Other",
];

const commonFieldsSchema = recordFeePaymentSchema.omit({ studentId: true, amount: true });
type CommonFields = z.infer<typeof commonFieldsSchema>;

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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const saved = localStorage.getItem("pendingPayments");
    if (saved) {
      setPendingPayments(JSON.parse(saved));
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

  const { data: paymentRecords = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery<FeePaymentRecordWithDetails[]>({
    queryKey: ["/api/payments/records", schoolId, statusFilter],
    queryFn: async () => {
      let url = "/api/payments/records?";
      if (schoolId) url += `schoolId=${schoolId}&`;
      if (statusFilter && statusFilter !== "all") url += `status=${statusFilter}&`;
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

  // Compute per-student share from shared total amount
  const studentCount = selectedEntries.length;
  const perStudentBase = studentCount > 0 ? Math.floor(totalAmount / studentCount) : 0;
  const remainder = studentCount > 0 ? totalAmount - perStudentBase * studentCount : 0;

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

    if (studentCount > 1 && totalAmount < studentCount) {
      toast({
        title: "Amount Too Low",
        description: `Total amount must be at least ₦${studentCount} when splitting across ${studentCount} students.`,
        variant: "destructive",
      });
      return;
    }

    const resolvedPurpose = commonData.purpose === "Other" ? (customPurpose.trim() || "Other") : commonData.purpose;
    const dataWithPurpose = { ...commonData, purpose: resolvedPurpose };

    if (!isOnline) {
      const offlinePayments = selectedEntries.map((entry, idx) => ({
        ...dataWithPurpose,
        studentId: entry.student.id,
        amount: idx === 0 ? perStudentBase + remainder : perStudentBase,
        offlineId: `offline_${Date.now()}_${entry.student.id}`,
        createdAt: new Date().toISOString(),
      }));
      setPendingPayments([...pendingPayments, ...offlinePayments]);
      toast({
        title: "Payments Saved Offline",
        description: `${offlinePayments.length} payment(s) will be synced when you're back online.`,
      });
      closeAndReset();
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (let idx = 0; idx < selectedEntries.length; idx++) {
      const entry = selectedEntries[idx];
      const entryAmount = idx === 0 ? perStudentBase + remainder : perStudentBase;
      try {
        await recordPaymentMutation.mutateAsync({
          ...dataWithPurpose,
          studentId: entry.student.id,
          amount: entryAmount,
        });
        successCount++;
      } catch (err: any) {
        errors.push(`${entry.student.user?.lastName || entry.student.lastName} ${entry.student.user?.firstName || entry.student.firstName}: ${err.message || "Failed"}`);
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast({
        title: successCount === selectedEntries.length ? "Payments Recorded" : "Partially Recorded",
        description: `${successCount} of ${selectedEntries.length} payment(s) recorded successfully.${errors.length > 0 ? ` ${errors.length} failed.` : ""}`,
        variant: errors.length > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
    } else {
      toast({
        title: "All Payments Failed",
        description: errors.join("; "),
        variant: "destructive",
      });
    }

    if (successCount > 0) closeAndReset();
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
    setSelectedEntries([...selectedEntries, { student }]);
    setSearchQuery("");
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
                <DialogDescription>
                  Enter the total amount, search and add students — it will be split equally. Fill in the shared payment details below.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* Student Search */}
                  <div className="space-y-2">
                    <Label>Add Students</Label>
                    <div className="flex gap-2">
                      <Select value={classFilter} onValueChange={setClassFilter}>
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
                          filteredStudents.slice(0, 10).map((student) => (
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
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total Amount (shared across all selected students) */}
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
                        min={0}
                      />
                    </div>
                    {studentCount > 1 && totalAmount > 0 && totalAmount < studentCount && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                        Amount too low to split across {studentCount} students — minimum ₦{studentCount}.
                      </div>
                    )}
                    {studentCount > 1 && totalAmount >= studentCount && totalAmount > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                        ₦{totalAmount.toLocaleString()} ÷ {studentCount} students = ₦{perStudentBase.toLocaleString()} each
                        {remainder > 0 && ` (₦${remainder} added to first student)`}
                      </div>
                    )}
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
                        {selectedEntries.map((entry, idx) => {
                          const share = idx === 0 ? perStudentBase + remainder : perStudentBase;
                          return (
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
                                {totalAmount > 0 && (
                                  <span className="text-sm font-medium text-muted-foreground w-28 text-right">
                                    ₦{share.toLocaleString()}
                                  </span>
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Shared Payment Details */}
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="term"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Term</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select term" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="First Term">First Term</SelectItem>
                              <SelectItem value="Second Term">Second Term</SelectItem>
                              <SelectItem value="Third Term">Third Term</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="session"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2024/2025" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="What is this payment for?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_PURPOSES.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
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

                  <FormField
                    control={form.control}
                    name="depositorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depositor Name (Optional)</FormLabel>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Label>Filter by Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
          <Button variant="outline" size="sm" onClick={() => refetchRecords()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {pendingPayments.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Pending Offline Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-2">
                {pendingPayments.length} payment(s) waiting to sync
              </div>
              {isOnline && (
                <Button size="sm" variant="outline" onClick={syncPendingPayments}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              )}
            </CardContent>
          </Card>
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
                  <TableHead>Method</TableHead>
                  <TableHead>Term/Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : sortedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No payment records found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm">
                        {record.paymentDate
                          ? new Date(record.paymentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {record.student?.user?.lastName} {record.student?.user?.firstName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.student?.studentId}
                        </div>
                        {record.depositorName && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            via {record.depositorName}
                          </div>
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
                      <TableCell className="capitalize text-sm">
                        {record.paymentMethod}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.term} / {record.session}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.recordedByUser?.firstName} {record.recordedByUser?.lastName}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
