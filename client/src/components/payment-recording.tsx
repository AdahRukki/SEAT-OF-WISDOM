import "@/components/finance-mobile.css";

function formatRecordedAt(value: string | Date | null | undefined): string {
  if (!value) return "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date) + " WAT";
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { generateClientRequestId, queuedApiRequest, addSyncListener, getQueuedClientRequestIds, processOfflineQueue } from "@/lib/offline-queue";
import { DuplicateReviewSheet } from "@/components/duplicate-review-sheet";
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
  EyeOff,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { recordFeePaymentSchema, type FeePaymentRecordWithDetails, type FeePaymentStudentSplit, type FeeType } from "@shared/schema";

type RecordPaymentForm = z.infer<typeof recordFeePaymentSchema>;

const commonFieldsSchema = recordFeePaymentSchema.omit({ studentId: true, amount: true, purpose: true });
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
  const day = parsed.getDate();
  const month = parsed.toLocaleString("en-GB", { month: "short" });
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
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
  const [reviewPair, setReviewPair] = useState<{ kind: 'transaction' | 'payment'; id: string } | null>(null);
  const [isBodyVisible, setIsBodyVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<SelectedStudentEntry[]>([]);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [additionalPayments, setAdditionalPayments] = useState<{id:string;studentId:string;purpose:string;customPurpose:string;amount:number}[]>([]);
  const submissionLock = useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Snapshot of pendingPayments restored from localStorage on mount. The
  // reconcile effect only inspects rows that were already persisted at load
  // time so a brand-new in-flight submission is never misclassified as an
  // orphan from a prior session.
  const hydratedPendingRef = useRef<any[] | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // NOTE: we no longer auto-replay pendingPayments via the legacy
    // syncPendingPayments() helper because optimistic rows for multi-student
    // submissions also live in this list and must NOT be re-posted as
    // single-payment rows. The offline queue handles the actual replay of
    // original requests with their correct endpoint/body.
    const saved = localStorage.getItem("pendingPayments");
    if (saved) {
      const loaded = JSON.parse(saved);
      hydratedPendingRef.current = loaded;
      setPendingPayments(loaded);
    } else {
      hydratedPendingRef.current = [];
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pendingPayments", JSON.stringify(pendingPayments));
  }, [pendingPayments]);

  // (Intentionally no auto-syncPendingPayments on isOnline — the offline
  // queue is the single source of truth for replay; this list is purely
  // optimistic UI state.)

  // Per-operation reconciliation: when the queue drains, only mutate the
  // optimistic rows whose clientRequestId matches a confirmed outcome.
  //  - succeededOps  -> remove the row (canonical record arrives via refetch)
  //  - droppedOps    -> mark the row 'failed' so Retry/Discard becomes available
  //  - retryingOps   -> leave as 'pending-sync' so it stays visible
  // Rows with no matching outcome stay as-is so nothing is silently lost.
  useEffect(() => {
    const off = addSyncListener((status) => {
      if (!status.justSynced) return;
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/tuition-balances"] });
      const succeededIds = new Set((status.succeededOps ?? []).map(o => o.clientRequestId).filter(Boolean) as string[]);
      const droppedIds = new Set((status.droppedOps ?? []).map(o => o.clientRequestId).filter(Boolean) as string[]);
      if (succeededIds.size === 0 && droppedIds.size === 0) return;
      setPendingPayments((prev) => prev
        .filter(p => !(p.clientRequestId && succeededIds.has(p.clientRequestId)))
        .map(p => (p.clientRequestId && droppedIds.has(p.clientRequestId))
          ? { ...p, __status: 'failed' as const }
          : p),
      );
    });
    return off;
  }, [queryClient]);

  // Single-shot reconciliation on mount.
  //
  // Bug being fixed: an optimistic row is added to `pendingPayments` with
  // status 'saving' BEFORE queuedApiRequest's 30s in-flight fetch completes.
  // If the user reloads / closes / navigates away during those 30s, the row
  // is persisted to localStorage as 'saving' but no offline-queue entry was
  // ever enqueued (enqueue only happens AFTER the timeout aborts). Result:
  // the row is stuck on "Saving" forever with nothing to drive it.
  //
  // Reconcile: for any persisted row in a transient state ('saving',
  // 'pending-sync', 'pending-slow') whose clientRequestId is NOT in the
  // current offline queue, replay the original __submission once via
  // queuedApiRequest. The server's clientRequestId unique index dedupes
  // safely if the original actually completed; otherwise the request is
  // (re)created or (re)queued. If even this attempt errors out, the row
  // is demoted to 'failed' so the existing Retry/Discard UI takes over.
  const didReconcileRef = useRef(false);
  useEffect(() => {
    if (didReconcileRef.current) return;
    // Wait until the localStorage hydration effect has run so we always
    // reconcile against rows that came from a previous session, never
    // against a brand-new optimistic row from a still-in-flight submission.
    const hydrated = hydratedPendingRef.current;
    if (hydrated === null) return;
    didReconcileRef.current = true;
    if (hydrated.length === 0) return;

    const transient = new Set(['saving', 'pending-sync', 'pending-slow']);
    const queuedIds = getQueuedClientRequestIds();

    // Group orphaned rows by clientRequestId so we replay each submission once
    // (multi-student rows share one clientRequestId / one __submission).
    const orphansByKey = new Map<string, any>();
    for (const row of hydrated) {
      const key = row.clientRequestId;
      if (!key) continue;
      if (!transient.has(row.__status)) continue;
      if (queuedIds.has(key)) continue;
      if (!row.__submission) continue;
      if (!orphansByKey.has(key)) orphansByKey.set(key, row);
    }

    if (orphansByKey.size === 0) {
      // Nothing orphaned, but still kick the queue once in case any
      // in-flight syncs were missed while the page was hidden.
      processOfflineQueue().catch(() => {});
      return;
    }

    (async () => {
      for (const [key, row] of Array.from(orphansByKey.entries())) {
        const matchSibling = (p: any) => p.clientRequestId === key;
        // Visually distinguish reconciled rows so the user knows we're acting.
        setPendingPayments(prev => prev.map(p =>
          matchSibling(p) ? { ...p, __status: 'saving', __error: undefined } : p,
        ));
        try {
          const res = await queuedApiRequest(
            row.__submission.url,
            { method: 'POST', body: row.__submission.body },
            row.__submission.type,
          );
          if (res?.queued) {
            const nextStatus = res.offline ? 'pending-sync' : 'pending-slow';
            setPendingPayments(prev => prev.map(p =>
              matchSibling(p) ? { ...p, __status: nextStatus } : p,
            ));
          } else {
            // Server accepted (new or idempotent replay) — drop optimistic rows
            // and refetch canonical records.
            setPendingPayments(prev => prev.filter(p => !matchSibling(p)));
            queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
            queryClient.invalidateQueries({ queryKey: ["/api/payments/tuition-balances"] });
          }
        } catch (err: any) {
          setPendingPayments(prev => prev.map(p =>
            matchSibling(p)
              ? { ...p, __status: 'failed', __error: err?.message || 'Sync interrupted — click Retry' }
              : p,
          ));
        }
      }
    })();
  }, [pendingPayments, queryClient]);

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

  // Fetch historical class membership so the class filter works for past sessions
  // (after promotion students have a new classId, so s.classId !== classFilter would exclude them)
  const { data: historicalClassStudents = [] } = useQuery<Student[]>({
    queryKey: ['/api/admin/students/historical-by-class', classFilter, filterTerm, filterSession, 'finance'],
    queryFn: () => apiRequest(`/api/admin/students/historical-by-class?classId=${classFilter}&term=${encodeURIComponent(filterTerm)}&session=${encodeURIComponent(filterSession)}&context=finance`),
    enabled: classFilter !== "all" && !!filterTerm && !!filterSession,
  });
  const historicalClassStudentIds = useMemo(
    () => new Set(historicalClassStudents.map((s: Student) => s.id)),
    [historicalClassStudents]
  );

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

  const form = useForm<CommonFields>({
    resolver: zodResolver(commonFieldsSchema),
    defaultValues: {
      paymentMethod: "transfer",
      paymentDate: new Date().toISOString().split("T")[0],
      depositorName: "",
      reference: "",
      term: currentTerm || "",
      session: currentSession || "",
      notes: "",
    },
  });

  const entryTerm = form.watch("term");
  const entrySession = form.watch("session");
  const tuitionFeeType = feeTypesData.find(ft => ft.isTuition && ft.isActive);

  // Fresh confirmed and pending tuition balances for the form period, fetched only
  // when the dialog is open so we don't ping the server unnecessarily.
  const { data: tuitionBalancesData = [], isFetching: balancesLoading, isError: balancesError } = useQuery<{
    studentDbId: string; tuitionAssigned: number; tuitionPaid: number; tuitionPending: number; tuitionKnown: boolean;
  }[]>({
    queryKey: ["/api/payments/tuition-balances", "entry", schoolId, entryTerm, entrySession],
    queryFn: async () => apiRequest(`/api/payments/entry-balances?${new URLSearchParams({schoolId:schoolId || '',term:entryTerm,session:entrySession})}`),
    enabled: isRecordDialogOpen && !!schoolId && !!entryTerm && !!entrySession,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const tuitionBalanceMap = useMemo(() => new Map(tuitionBalancesData.map(r => [r.studentDbId, {
    assigned:r.tuitionAssigned,paid:r.tuitionPaid,pending:r.tuitionPending,known:r.tuitionKnown,
    due:Math.max(0,Math.round((r.tuitionAssigned-r.tuitionPaid-r.tuitionPending)*100)/100),
  }])), [tuitionBalancesData]);

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


  // Legacy helper kept for the manual "Sync Now" button. Replays ONLY rows
  // that originated as single-student offline submissions (offlineId prefix
  // 'offline_'); optimistic rows for multi-student requests are skipped here
  // because the offline queue replays the original /multi request with its
  // own clientRequestId.
  const syncPendingPayments = async () => {
    const toSync = pendingPayments.filter(p => typeof p.offlineId === 'string' && p.offlineId.startsWith('offline_'));
    const keep = pendingPayments.filter(p => !(typeof p.offlineId === 'string' && p.offlineId.startsWith('offline_')));
    const failedAttempts: any[] = [];

    for (const payment of toSync) {
      try {
        // payment object already carries its clientRequestId — server dedupes replays
        await apiRequest("/api/payments/record", { method: "POST", body: payment });
      } catch {
        failedAttempts.push(payment);
      }
    }

    // Counts must reflect ONLY rows we actually attempted to sync — not the
    // unrelated optimistic rows we had to retain for visibility.
    const syncedCount = toSync.length - failedAttempts.length;
    const failedCount = failedAttempts.length;

    // Persist: keep failed-this-pass items + any rows we never tried.
    setPendingPayments([...failedAttempts, ...keep]);

    if (failedCount === 0) {
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${syncedCount} pending payment(s).`,
      });
    } else {
      toast({
        title: "Partial Sync",
        description: `${syncedCount} synced, ${failedCount} failed.`,
        variant: "destructive",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/tuition-balances"] });
  };

  const studentCount = selectedEntries.length;
  const paymentRows = additionalPayments.map(row=>({studentId:row.studentId,purpose:row.purpose==='Other'?row.customPurpose.trim():row.purpose,amount:row.amount}));
  const paymentTotal = paymentRows.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
  const tuitionTotal = paymentRows.filter(row=>feeTypesData.some(ft=>ft.isTuition&&ft.name===row.purpose)).reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
  const tuitionWarnings = selectedEntries.flatMap(({student})=>{
    const requested=paymentRows.filter(row=>row.studentId===student.id&&feeTypesData.some(ft=>ft.isTuition&&ft.name===row.purpose)).reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
    if(!requested) return [];
    const bal=tuitionBalanceMap.get(student.id);
    const name=[student.user?.firstName || student.firstName,student.user?.lastName || student.lastName].filter(Boolean).join(' ');
    if(balancesLoading) return [`Checking tuition for ${name}…`];
    if(balancesError || !bal?.known) return [`Tuition for ${name} is not verified. Check the term and tuition settings.`];
    return requested > bal.due ? [`${name}: ₦${(requested-bal.due).toLocaleString()} above available tuition. Pending payments are included. Reduce tuition and add another purpose.`] : [];
  });

  const onSubmit = async (commonData: CommonFields) => {
    if(submissionLock.current) return;
    const invalid=paymentRows.some(row=>!row.purpose||!selectedEntries.some(e=>e.student.id===row.studentId)||!Number.isFinite(row.amount)||row.amount<=0||Number(row.amount.toFixed(2))!==row.amount);
    if(!schoolId || !studentCount || invalid || !paymentRows.length || amountReceived<=0 || tuitionWarnings.length || Math.round(amountReceived*100)!==Math.round(paymentTotal*100)) {
      toast({title:'Check payment details',description:tuitionWarnings[0] || 'Enter a purpose and amount for every payment. The breakdown must equal the amount received.',variant:'destructive'});return;
    }
    submissionLock.current=true;setIsSubmitting(true);
    const submissionKey=generateClientRequestId();
    const optimisticId=`opt_${submissionKey}`;
    const submission={url:'/api/payments/records/batch',type:'create-payment-batch',body:{...commonData,schoolId,totalAmount:amountReceived,rows:paymentRows,clientRequestId:submissionKey}};
    setPendingPayments(prev=>[...prev,{...commonData,amount:amountReceived,purpose:Array.from(new Set(paymentRows.map(row=>row.purpose))).join(', '),allocationCount:paymentRows.length,student:studentCount===1?selectedEntries[0].student:undefined,offlineId:optimisticId,clientRequestId:submissionKey,createdAt:new Date().toISOString(),__status:'saving',__submission:submission}]);
    const remove=()=>setPendingPayments(prev=>prev.filter(p=>p.clientRequestId!==submissionKey));
    try {
      const result=await queuedApiRequest(submission.url,{method:'POST',body:submission.body},submission.type);
      if(result?.queued){
        setPendingPayments(prev=>prev.map(p=>p.clientRequestId===submissionKey?{...p,__status:result.offline?'pending-sync':'pending-slow'}:p));
        toast({title:result.offline?'Saved offline':'Waiting for connection',description:'The complete payment breakdown will sync together. Tuition balances will be checked again.'});
      } else {
        remove();
        queryClient.invalidateQueries({queryKey:['/api/payments/records']});
        queryClient.invalidateQueries({queryKey:['/api/payments/tuition-balances']});
        queryClient.invalidateQueries({queryKey:['/api/admin/financial-summary']});
        toast({title:'Payment recorded',description:`One payment of ₦${paymentTotal.toLocaleString()} with ${paymentRows.length} allocations is awaiting confirmation.`});
      }
      closeAndReset();
    } catch(error:any){
      if(/^4\d\d:/.test(error.message||'')){remove();}
      else {
        setPendingPayments(prev=>prev.map(p=>p.clientRequestId===submissionKey?{...p,__status:'failed',__error:error.message}:p));
        closeAndReset();
      }
      queryClient.invalidateQueries({queryKey:['/api/payments/tuition-balances']});
      toast({title:'Payment not saved',description:error.message||'Retry the saved submission.',variant:'destructive'});
    } finally {submissionLock.current=false;setIsSubmitting(false);}
  };

  // Retry a failed optimistic payment row. Reuses its stable clientRequestId
  // so the server safely dedupes if the original request actually succeeded.
  // For multi-student submissions, every sibling row shares one __submission;
  // a retry replays the original /multi request once and updates every sibling.
  const retryFailedPayment = async (offlineId: string) => {
    const row = pendingPayments.find(p => p.offlineId === offlineId);
    if (!row) return;
    // Backwards-compat: rows created before __submission existed default to single endpoint
    const submission = row.__submission ?? {
      url: '/api/payments/record',
      type: 'create-payment-record',
      body: {
        studentId: row.studentId,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        paymentDate: row.paymentDate,
        purpose: row.purpose,
        depositorName: row.depositorName,
        reference: row.reference,
        term: row.term,
        session: row.session,
        notes: row.notes,
        clientRequestId: row.clientRequestId,
      },
    };
    const siblingMatch = (p: any) => p.clientRequestId && p.clientRequestId === row.clientRequestId;
    setPendingPayments(prev => prev.map(p => siblingMatch(p) ? { ...p, __status: 'saving', __error: undefined } : p));
    try {
      const res = await queuedApiRequest(submission.url, { method: 'POST', body: submission.body }, submission.type);
      if (res?.queued) {
        const nextStatus = res.offline ? 'pending-sync' : 'pending-slow';
        setPendingPayments(prev => prev.map(p => siblingMatch(p) ? { ...p, __status: nextStatus } : p));
        toast({ title: "Queued", description: "Will sync when network recovers." });
      } else {
        setPendingPayments(prev => prev.filter(p => !siblingMatch(p)));
        queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/tuition-balances"] });
        toast({ title: res?.idempotent ? "Already Recorded" : "Payment Recorded" });
      }
    } catch (err: any) {
      setPendingPayments(prev => prev.map(p => siblingMatch(p) ? { ...p, __status: 'failed', __error: err?.message } : p));
      toast({ title: "Retry Failed", description: err?.message || "Try again", variant: "destructive" });
    }
  };

  // Discarding a row removes all siblings from the same submission so the
  // user doesn't see half a multi-student split lingering after they discard.
  const discardFailedPayment = (offlineId: string) => {
    const row = pendingPayments.find(p => p.offlineId === offlineId);
    const key = row?.clientRequestId;
    setPendingPayments(prev => prev.filter(p =>
      key ? p.clientRequestId !== key : p.offlineId !== offlineId,
    ));
  };

  const closeAndReset = () => {
    setIsRecordDialogOpen(false);
    setSelectedEntries([]);
    setAmountReceived(0);
    setAdditionalPayments([]);
    setSearchQuery("");
    setClassFilter("all");
    form.reset({
      paymentMethod: "transfer",
      paymentDate: new Date().toISOString().split("T")[0],
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
    setAdditionalPayments(prev=>[...prev,{id:generateClientRequestId(),studentId:student.id,purpose:tuitionFeeType?.name||'',customPurpose:'',amount:0}]);
    setSearchQuery("");
  };

  const selectedIds = new Set(selectedEntries.map((e) => e.student.id));

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim() && classFilter === "all") return false;
    if (selectedIds.has(s.id)) return false;
    if (classFilter !== "all" && s.classId !== classFilter && !historicalClassStudentIds.has(s.id)) return false;
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
        if (
          r.student?.user?.lastName?.toLowerCase().includes(q) ||
          r.student?.user?.firstName?.toLowerCase().includes(q) ||
          r.student?.studentId?.toLowerCase().includes(q)
        ) return true;
        // Multi-student records: match against any child split's student.
        for (const sp of r.splits ?? []) {
          if (
            sp.student?.user?.lastName?.toLowerCase().includes(q) ||
            sp.student?.user?.firstName?.toLowerCase().includes(q) ||
            sp.student?.studentId?.toLowerCase().includes(q)
          ) return true;
        }
        return false;
      })
    : sortedRecords;

  const totalRecords = nameFilteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = nameFilteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = totalRecords === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRecords);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // Sub-admins (in addition to admins) may act on duplicate flags within their own school.
  const canActOnDuplicates = user?.role === "admin" || user?.role === "sub-admin";

  // Task #128: clear/reverse-as-duplicate mutations.
  const clearPaymentDuplicateMutation = useMutation({
    mutationFn: async (paymentId: string) =>
      apiRequest(`/api/admin/payments/${paymentId}/clear-duplicate`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Duplicate flag cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const reverseAsDuplicateMutation = useMutation({
    mutationFn: async (paymentId: string) =>
      apiRequest(`/api/admin/payments/${paymentId}/reverse-as-duplicate`, {
        method: "POST",
        body: { reason: "Reversed as duplicate" },
      }),
    onSuccess: () => {
      toast({ title: "Payment reversed as duplicate" });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/records"] });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
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
    <div className="finance-mobile space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBodyVisible((v) => !v)}
            aria-label={isBodyVisible ? "Hide payment records" : "Show payment records"}
            data-testid="button-toggle-payment-body"
          >
            {isBodyVisible ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" /> Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" /> Show
              </>
            )}
          </Button>
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
          <Dialog open={isRecordDialogOpen} onOpenChange={(open) => { if (!open && !submissionLock.current) closeAndReset(); else if (open) { form.setValue("term", currentTerm || ""); form.setValue("session", currentSession || ""); setIsRecordDialogOpen(true); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="finance-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Fee Payment</DialogTitle>
                {/* UX #1: description matches actual form order */}
                <DialogDescription>
                  One transfer, one confirmation. Allocate it to students below.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                  <p className="text-sm text-muted-foreground">{entryTerm} · {entrySession}</p>
                  <label className="block text-sm font-medium">Amount received (₦)<Input className="mt-1 min-h-11" type="number" min="0.01" step="0.01" value={amountReceived||''} onChange={e=>setAmountReceived(Number(e.target.value))}/></label>
                  {/* Term & Session are auto-filled from currently active academic info */}

                  {/* Payment Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  {/* Student Search */}
                  <div className="space-y-2">
                    <Label>Add Students</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* UX #4: clear search when switching class filter */}
                      <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setSearchQuery(""); }}>
                        <SelectTrigger className="w-full sm:w-[160px] flex-shrink-0" aria-label="Filter by class">
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

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Allocations</div>
                    {additionalPayments.length===0 && <p className="text-sm text-muted-foreground">Search for a student above to add the first allocation.</p>}
                    {additionalPayments.map((row,index)=>{
                      const balance=tuitionBalanceMap.get(row.studentId);
                      return <div key={row.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="min-w-0 flex-1 text-xs">Student
                            <select aria-label={`Student for allocation ${index+1}`} className="mt-1 min-h-11 w-full rounded-md border bg-background p-2 text-sm" value={row.studentId} onChange={e=>setAdditionalPayments(prev=>prev.map(p=>p.id===row.id?{...p,studentId:e.target.value}:p))}>
                              {selectedEntries.map(({student})=><option key={student.id} value={student.id}>{student.user?.lastName||student.lastName} {student.user?.firstName||student.firstName} ({student.studentId})</option>)}
                            </select>
                          </label>
                          <Button type="button" variant="ghost" size="icon" className="mt-4 shrink-0" aria-label={`Remove allocation ${index+1}`} onClick={()=>setAdditionalPayments(prev=>prev.filter(p=>p.id!==row.id))}><X className="h-4 w-4"/></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="min-w-0 text-xs">Purpose<select className="mt-1 min-h-11 w-full rounded-md border bg-background p-2 text-sm" value={row.purpose} onChange={e=>setAdditionalPayments(prev=>prev.map(p=>p.id===row.id?{...p,purpose:e.target.value}:p))}><option value="">Select purpose</option>{feeTypesData.filter(ft=>ft.isActive).map(ft=><option key={ft.id} value={ft.name}>{ft.name}</option>)}<option value="Other">Other — describe</option></select></label>
                          <label className="min-w-0 text-xs">Amount (₦)<Input aria-label={`Amount for allocation ${index+1}`} className="mt-1 min-h-11" type="number" min="0.01" step="0.01" value={row.amount||''} onChange={e=>setAdditionalPayments(prev=>prev.map(p=>p.id===row.id?{...p,amount:Number(e.target.value)}:p))}/></label>
                        </div>
                        {row.purpose==='Other'&&<Input aria-label="Describe payment purpose" placeholder="Describe the purpose" maxLength={100} value={row.customPurpose} onChange={e=>setAdditionalPayments(prev=>prev.map(p=>p.id===row.id?{...p,customPurpose:e.target.value}:p))}/>}
                        {feeTypesData.some(ft=>ft.isTuition&&ft.name===row.purpose)&&<p className="text-xs text-muted-foreground">{balancesLoading?'Checking tuition…':balance?.known?`Available tuition: ₦${balance.due.toLocaleString()} (pending payments included)`:'Tuition not verified for this period'}</p>}
                      </div>;
                    })}
                    <Button type="button" variant="outline" className="min-h-11 w-full" disabled={!studentCount||additionalPayments.length>=100} onClick={()=>setAdditionalPayments(prev=>[...prev,{id:generateClientRequestId(),studentId:selectedEntries[0]?.student.id||'',purpose:tuitionFeeType?.name||'',customPurpose:'',amount:0}])}><Plus className="mr-2 h-4 w-4"/>Add allocation</Button>
                  </div>

                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">More details <span className="font-normal text-muted-foreground">(reference and notes)</span></summary>
                    <div className="mt-3 space-y-3">
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

                    </div>
                  </details>
                  {tuitionWarnings.map(message=><p key={message} role="alert" className="text-sm text-destructive">{message}</p>)}
                  <div className="sticky bottom-0 z-10 bg-background border-t pt-3 pb-2 space-y-2">
                    <div className="flex flex-wrap justify-between gap-1 text-sm" aria-live="polite"><span>Allocated: <strong>₦{paymentTotal.toLocaleString()}</strong></span><span className={Math.round(amountReceived*100)===Math.round(paymentTotal*100)?'text-green-700':'text-amber-700'}>{paymentTotal>amountReceived?'Over by':'Remaining'}: ₦{Math.abs(Math.round((amountReceived-paymentTotal)*100)/100).toLocaleString()}</span></div>
                    <p className="text-xs text-muted-foreground">Tuition ₦{tuitionTotal.toLocaleString()} · Other ₦{(Math.round((paymentTotal-tuitionTotal)*100)/100).toLocaleString()}</p>
                    <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeAndReset}
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isSubmitting || paymentRows.length === 0 || tuitionWarnings.length>0 || amountReceived<=0 || Math.round(amountReceived*100)!==Math.round(paymentTotal*100)}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Recording...
                        </>
                      ) : isOnline ? (
                        "Record payment"
                      ) : (
                        "Save Offline"
                      )}
                    </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isBodyVisible && (
      <>
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

        {pendingPayments.length > 0 && (() => {
          const saving = pendingPayments.filter(p => p.__status === 'saving').length;
          const slow = pendingPayments.filter(p => p.__status === 'pending-slow').length;
          const pending = pendingPayments.filter(p => p.__status === 'pending-sync').length;
          const failed = pendingPayments.filter(p => p.__status === 'failed').length;
          // Legacy single-payment offline rows (created before queue-based replay)
          // are identified by an offlineId starting with 'offline_'. They are not
          // auto-replayed; expose a manual "Sync Now" button so they aren't stuck.
          const legacyCount = pendingPayments.filter(
            p => typeof p.offlineId === 'string' && p.offlineId.startsWith('offline_')
          ).length;
          const parts: string[] = [];
          if (saving) parts.push(`${saving} saving`);
          if (slow) parts.push(`${slow} saving on slow network`);
          if (pending) parts.push(`${pending} pending sync`);
          if (failed) parts.push(`${failed} failed`);
          return (
            <div className="flex items-center justify-between gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                <span>{parts.length > 0 ? parts.join(' · ') : `${pendingPayments.length} payment(s) in progress`}</span>
              </div>
              {legacyCount > 0 && isOnline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => syncPendingPayments()}
                  data-testid="button-sync-now-legacy"
                >
                  Sync Now ({legacyCount})
                </Button>
              )}
            </div>
          );
        })()}

        <Card>
          <CardContent className="p-0">
            <Table className="finance-payment-cards">
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
                {/* Optimistic rows: every Submit click appears here immediately
                    with a status badge, regardless of network. Saving / Pending
                    sync / Failed states with retry+discard for failed. */}
                {pendingPayments.map((p) => {
                  const status = p.__status || 'pending-sync';
                  const badge = status === 'saving'
                    ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</Badge>
                    : status === 'failed'
                    ? <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Failed</Badge>
                    : status === 'pending-slow'
                    ? <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300" title="Request is in flight on a slow network and will be retried automatically."><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving — slow network</Badge>
                    : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending sync</Badge>;
                  return (
                    <TableRow data-finance-card data-saved-payment="false" key={p.offlineId} className={status === 'failed' ? 'bg-red-50/30' : 'bg-blue-50/20'} data-testid={`row-pending-payment-${p.offlineId}`}>
                      <TableCell data-label="Payment date" className="text-sm">{formatPaymentDate(p.paymentDate)}</TableCell>
                      <TableCell data-label="Student">
                        {p.student ? (
                          <>
                            <div className="font-medium text-sm">
                              {p.student.user?.lastName || p.student.lastName} {p.student.user?.firstName || p.student.firstName}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.student.studentId}</div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">{p.allocationCount ? `${p.allocationCount} allocations` : "—"}</span>
                        )}
                      </TableCell>
                      <TableCell data-label="Class" className="text-sm text-muted-foreground">{p.student?.class?.name || '—'}</TableCell>
                      <TableCell data-label="Amount" className="font-medium">₦{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell data-label="Purpose" className="text-sm">{p.purpose || '—'}</TableCell>
                      <TableCell data-label="Method" className="text-sm">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                      <TableCell data-label="Reference" className="text-sm text-muted-foreground font-mono">{p.reference || '—'}</TableCell>
                      <TableCell data-label="Term / Session" className="text-sm">{p.term} / {p.session}</TableCell>
                      <TableCell data-label="Status">
                        <div className="flex flex-col gap-1">
                          {badge}
                          {status === 'failed' && p.__error && (
                            <span className="text-[10px] text-red-600 max-w-[160px] truncate" title={p.__error}>{p.__error}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-label="Depositor" className="text-sm text-muted-foreground">{p.depositorName || '—'}</TableCell>
                      <TableCell data-label="Recorded by" className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell data-label="Actions" className="text-right">
                        {status === 'failed' ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => retryFailedPayment(p.offlineId)} title="Retry" data-testid={`button-retry-${p.offlineId}`}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => discardFailedPayment(p.offlineId)} title="Discard" data-testid={`button-discard-${p.offlineId}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {recordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : totalRecords === 0 && pendingPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No payment records found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow data-finance-card data-saved-payment="true" key={record.id}>
                      {/* Fix #6: date parsed with local-time anchor to avoid off-by-one */}
                      <TableCell data-label="Payment date" className="text-sm">
                        {formatPaymentDate(record.paymentDate)}
                        <div className="text-xs text-muted-foreground whitespace-nowrap">Recorded: {formatRecordedAt(record.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">Confirmed: {formatRecordedAt(record.confirmedAt)}</div>
                      </TableCell>
                      <TableCell data-label="Student">
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
                            {record.splitCount ?? "N"} allocations
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell data-label="Class" className="text-sm text-muted-foreground">
                        {record.student?.class?.name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell data-label="Amount" className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>₦{parseFloat(record.amount).toLocaleString()}</span>
                          {record.posFee && record.posFee > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] w-fit"
                              title={`Bank credited ₦${(parseFloat(record.amount) - record.posFee).toLocaleString()} after Moniepoint POS fee`}
                              data-testid={`badge-pos-fee-${record.id}`}
                            >
                              −₦{record.posFee.toLocaleString()} POS fee
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-label="Purpose" className="text-sm">
                        {record.purpose || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Fix #3: use METHOD_LABELS lookup instead of CSS capitalize */}
                      <TableCell data-label="Method" className="text-sm">
                        {METHOD_LABELS[record.paymentMethod] ?? record.paymentMethod}
                      </TableCell>
                      {/* Fix #4: reference column */}
                      <TableCell data-label="Reference" className="text-sm text-muted-foreground font-mono">
                        {record.reference || <span className="not-italic font-sans">—</span>}
                      </TableCell>
                      <TableCell data-label="Term / Session" className="text-sm">
                        {record.term} / {record.session}
                      </TableCell>
                      <TableCell data-label="Status">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(record.status)}
                          {record.possibleDuplicate && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-50 text-amber-800 border-amber-400"
                              title="Same student, same day, same amount as another non-reversed payment. Confirmation is blocked until resolved."
                              data-testid={`badge-record-possible-duplicate-${record.id}`}
                            >
                              ⚠ Possible duplicate
                            </Badge>
                          )}
                          {record.possibleDuplicate && record.status !== 'reversed' && (
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[10px] h-6 px-2"
                                title="Compare both entries side-by-side"
                                onClick={() => setReviewPair({ kind: 'payment', id: record.id })}
                                data-testid={`button-record-review-duplicate-${record.id}`}
                              >
                                Review
                              </Button>
                              {canActOnDuplicates && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[10px] h-6 px-2"
                                    title="Not a duplicate — clear flag"
                                    disabled={clearPaymentDuplicateMutation.isPending}
                                    onClick={() => clearPaymentDuplicateMutation.mutate(record.id)}
                                    data-testid={`button-record-clear-duplicate-${record.id}`}
                                  >
                                    Clear
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[10px] h-6 px-2 text-red-700 border-red-300"
                                    title="Reverse as duplicate"
                                    disabled={reverseAsDuplicateMutation.isPending}
                                    onClick={() => {
                                      if (window.confirm("Reverse this payment as a duplicate?")) {
                                        reverseAsDuplicateMutation.mutate(record.id);
                                      }
                                    }}
                                    data-testid={`button-record-reverse-duplicate-${record.id}`}
                                  >
                                    Reverse
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {/* UX #5: depositor moved from Student cell to own column */}
                      <TableCell data-label="Depositor" className="text-sm text-muted-foreground">
                        {record.depositorName || <span>—</span>}
                      </TableCell>
                      {/* UX #6: fallback for missing recorded-by user */}
                      <TableCell data-label="Recorded by" className="text-sm text-muted-foreground">
                        {record.recordedByUser
                          ? `${record.recordedByUser.firstName} ${record.recordedByUser.lastName}`.trim()
                          : <span>—</span>
                        }
                      </TableCell>
                      <TableCell data-label="Actions" className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewingRecord(record)}
                          title="View details"
                          aria-label="View payment details"
                          data-testid={`button-view-payment-${record.id}`}
                        >
                          <Eye className="h-4 w-4" /><span className="sm:hidden ml-2">Details</span>
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
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
      </>
      )}

      <PaymentDetailsDialog
        record={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />
      <DuplicateReviewSheet
        kind={reviewPair?.kind ?? 'payment'}
        id={reviewPair?.id ?? null}
        open={!!reviewPair}
        onOpenChange={(o) => { if (!o) setReviewPair(null); }}
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
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/payments/records/${record!.id}/splits`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Failed to fetch payment splits");
      return res.json();
    },
  });

  if (!record) return null;

  const dateStr = formatPaymentDate(record.paymentDate);
  const statusLabel =
    record.status === "confirmed" ? "Confirmed" : record.status === "reversed" ? "Reversed" : "Pending";

  const reversedAtStr = record.reversedAt
    ? new Date(record.reversedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const reverserName = record.reversedByUser
    ? `${record.reversedByUser.firstName} ${record.reversedByUser.lastName}`.trim()
    : "—";

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="finance-dialog max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>Full information for this payment record.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <DetailRow label="Payment Date" value={dateStr} />
          <DetailRow label="Recorded At (Nigerian time)" value={formatRecordedAt(record.createdAt)} />
          <DetailRow label="Confirmed At (Nigerian time)" value={formatRecordedAt(record.confirmedAt)} />
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

          {record.status === "reversed" && (
            <>
              <Separator />
              <div className="space-y-2" data-testid="payment-reversal-section">
                <div className="text-xs uppercase text-red-700 dark:text-red-400 tracking-wide font-medium">
                  Reversal
                </div>
                <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Reason</div>
                    <div
                      className="whitespace-pre-wrap break-words text-foreground"
                      data-testid="payment-reversal-reason"
                    >
                      {record.reversalReason || "—"}
                    </div>
                  </div>
                  <DetailRow label="Reversed by" value={reverserName} />
                  <DetailRow label="Reversed at" value={reversedAtStr} />
                </div>
              </div>
            </>
          )}

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
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Payment allocations</div>
                <Badge variant="secondary" className="text-xs">
                  {splits?.length ?? record.splitCount ?? "…"} allocations
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
                          {s.student?.user ? `${s.student.user.lastName} ${s.student.user.firstName}` : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.student?.studentId || "—"} · {s.purpose || record.purpose || "—"}
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

