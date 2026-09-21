import { ConfirmationDateFilter, confirmationRangeLabel } from "@/components/confirmation-date-filter";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
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

import { useState, useEffect, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Eye, Search, Loader2, Printer, FileSpreadsheet, Columns3, Wallet } from "lucide-react";
import { DuplicateReviewSheet } from "@/components/duplicate-review-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/use-auth";

const COLUMN_DEFS = [
  { key: "name", label: "Student Name", required: true },
  { key: "studentId", label: "SOWA ID" },
  { key: "className", label: "Class" },
  { key: "studentType", label: "Student Type" },
  { key: "parentWhatsapp", label: "Parent WhatsApp" },
  { key: "tuition", label: "Tuition Fee (₦)" },
  { key: "discount", label: "Discount (₦)" },
  { key: "paid", label: "Total Paid (₦)" },
  { key: "misc", label: "Miscellaneous (₦)" },
  { key: "balance", label: "Balance (₦)" },
  { key: "status", label: "Status" },
  { key: "lastPayment", label: "Last Payment" },
] as const;
type ColKey = typeof COLUMN_DEFS[number]["key"];
const ALL_COL_KEYS: ColKey[] = COLUMN_DEFS.map((c) => c.key);
const COLUMNS_STORAGE_KEY_PREFIX = "sowa_finance_visible_columns";
// Sensitive columns are OFF by default for confidentiality on first use.
const DEFAULT_OFF: Set<ColKey> = new Set<ColKey>(["parentWhatsapp"]);

function storageKeyFor(userId?: string | null): string {
  return `${COLUMNS_STORAGE_KEY_PREFIX}:${userId || "anon"}`;
}

function loadVisibleColumns(userId?: string | null): Set<ColKey> {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      const valid = arr.filter((k): k is ColKey => (ALL_COL_KEYS as string[]).includes(k));
      const set = new Set<ColKey>(valid);
      set.add("name");
      return set;
    }
  } catch {}
  return new Set<ColKey>(ALL_COL_KEYS.filter((k) => !DEFAULT_OFF.has(k)));
}

function getEntryStatus(e: { tuitionAssigned: number; totalPaid: number }): string {
  if (!e.tuitionAssigned) return "—";
  if (e.totalPaid >= e.tuitionAssigned) return "Paid";
  if (e.totalPaid > 0) return "Partial";
  return "Owing";
}

function sanitizeFilenamePart(s: string): string {
  return (s || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "all";
}

function formatLedgerDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  let d: Date;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, day] = value.split("-").map(Number);
      d = new Date(y, m - 1, day);
    } else {
      const normalized = value.includes("T") ? value : value.replace(" ", "T");
      d = new Date(normalized);
    }
  } else {
    d = value;
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface LedgerEntry {
  studentDbId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  classId: string;
  parentWhatsapp: string | null;
  /** 'new' | 'returning' — effective type for the requested term/session */
  studentType: string;
  totalPaid: number;
  totalAssigned: number;
  tuitionAssigned: number;
  discount: number;
  balance: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  lastConfirmedAt?: string | null;
}

interface SchoolClass {
  id: string;
  name: string;
}

interface PaymentRecord {
  id: string;
  amount: string;
  purpose: string | null;
  paymentMethod: string | null;
  reference: string | null;
  status: string;
  paymentDate: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  isSplit?: boolean;
  possibleDuplicate?: boolean;
}

interface LedgerMeta {
  hasTuitionFeeType: boolean;
  hasGlobalTuition: boolean;
  hasScopedTuition: boolean;
}

interface LedgerResponse {
  entries: LedgerEntry[];
  meta: LedgerMeta;
}

interface PaymentLedgerProps {
  schoolId?: string;
  schoolName?: string;
  currentTerm?: string;
  currentSession?: string;
  userRole?: string;
  onOpenTuitionSetup?: () => void;
}

export function PaymentLedger({ schoolId, schoolName, currentTerm, currentSession, userRole, onOpenTuitionSetup }: PaymentLedgerProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>(currentTerm || "");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [confirmedFrom, setConfirmedFrom] = useState("");
  const [confirmedTo, setConfirmedTo] = useState("");
  const confirmationFiltered = !!(confirmedFrom || confirmedTo);
  const invalidConfirmationRange = !!(confirmedFrom && confirmedTo && confirmedFrom > confirmedTo);
  const [selectedSession, setSelectedSession] = useState<string>(currentSession || "");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<LedgerEntry | null>(null);
  const [reviewPair, setReviewPair] = useState<{ kind: 'transaction' | 'payment'; id: string } | null>(null);
  const [tuitionBannerDismissed, setTuitionBannerDismissed] = useState<string>("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "outstanding" | "paid" | "fully-paid">("all");
  const [studentTypeFilter, setStudentTypeFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColKey>>(() => loadVisibleColumns(userId));

  // Re-hydrate per-user preferences when the signed-in user changes.
  useEffect(() => {
    setVisibleColumns(loadVisibleColumns(userId));
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyFor(userId), JSON.stringify(Array.from(visibleColumns)));
    } catch {}
  }, [visibleColumns, userId]);

  const toggleColumn = (key: ColKey) => {
    if (key === "name") return;
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      next.add("name");
      return next;
    });
  };
  const isCol = (k: ColKey) => visibleColumns.has(k) && !(confirmationFiltered && ["balance", "status", "misc"].includes(k));

  useEffect(() => {
    if (currentTerm) setSelectedTerm(currentTerm);
  }, [currentTerm]);
  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  const { data: sessions = [] } = useQuery<{ id: string; sessionYear: string }[]>({
    queryKey: ["/api/admin/academic-sessions"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/admin/academic-sessions", { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sessionOptions: string[] = sessions.length > 0
    ? sessions.map((s) => s.sessionYear)
    : (() => {
        const base = currentSession
          ? parseInt(currentSession.split("/")[0]) || new Date().getFullYear()
          : new Date().getFullYear();
        return [`${base - 1}/${base}`, `${base}/${base + 1}`, `${base + 1}/${base + 2}`];
      })();

  const { data: schoolClasses = [] } = useQuery<SchoolClass[]>({
    queryKey: ["/api/admin/classes", schoolId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/classes?schoolId=${schoolId}`, { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!schoolId && !invalidConfirmationRange,
  });

  const params = new URLSearchParams();
  if (schoolId) params.set("schoolId", schoolId);
  if (selectedClassId && selectedClassId !== "all") params.set("classId", selectedClassId);
  if (selectedTerm) params.set("term", selectedTerm);
  if (selectedSession) params.set("session", selectedSession);
  if (confirmedFrom) params.set("confirmedFrom", confirmedFrom);
  if (confirmedTo) params.set("confirmedTo", confirmedTo);

  const { data: ledgerResponse, isLoading, isError: ledgerError } = useQuery<LedgerResponse>({
    queryKey: ["/api/payments/ledger", schoolId, selectedClassId, selectedTerm, selectedSession, confirmedFrom, confirmedTo],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/payments/ledger?${params.toString()}`, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch ledger");
      const json = await res.json();
      // Tolerate older array-shaped responses just in case.
      if (Array.isArray(json)) {
        return { entries: json, meta: { hasTuitionFeeType: false, hasGlobalTuition: false, hasScopedTuition: false } };
      }
      return json;
    },
    enabled: !!schoolId,
  });
  const ledger: LedgerEntry[] = ledgerResponse?.entries ?? [];
  const ledgerMeta: LedgerMeta = ledgerResponse?.meta ?? { hasTuitionFeeType: false, hasGlobalTuition: false, hasScopedTuition: false };

  const { data: allStudentRecords = [], isLoading: recordsLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments/student-history", schoolId, selectedStudent?.studentDbId, selectedTerm, selectedSession],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = `/api/payments/student-history/${selectedStudent!.studentDbId}?schoolId=${schoolId}&status=confirmed` +
        (selectedTerm ? `&term=${encodeURIComponent(selectedTerm)}` : "") +
        (selectedSession ? `&session=${encodeURIComponent(selectedSession)}` : "");
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedStudent && !!schoolId,
  });

  const studentRecords = allStudentRecords.filter(rec => {
    if (!confirmationFiltered) return true;
    if (!rec.confirmedAt) return false;
    const value = Date.parse(rec.confirmedAt);
    return Number.isFinite(value)
      && (!confirmedFrom || value >= Date.parse(confirmedFrom + "T00:00:00+01:00"))
      && (!confirmedTo || value < Date.parse(confirmedTo + "T00:00:00+01:00") + 86400000);
  });
  const searchedLedger = nameSearch.trim()
    ? (Array.isArray(ledger) ? ledger : []).filter((e) => {
        const q = nameSearch.toLowerCase();
        const name = `${e?.lastName ?? ""} ${e?.firstName ?? ""}`.toLowerCase();
        const sid = (e?.studentId ?? "").toLowerCase();
        return name.includes(q) || sid.includes(q);
      })
    : (Array.isArray(ledger) ? ledger : []);

  // Payment status narrows the search results using confirmed payments and tuition
  // (balance > 0). Type filter narrows to new or returning students.
  // Both flow through to the table, count, Excel export, Print view, and
  // admin grand total because they all read from filteredLedger.
  const filteredLedger = (() => {
    let result = searchedLedger.filter((e) => {
      if (confirmationFiltered) return e.paymentCount > 0;
      const hasPaid = e.paymentCount > 0 && e.totalPaid > 0;
      const assigned = Math.round((e.tuitionAssigned || 0) * 100);
      const paid = Math.round((e.totalPaid || 0) * 100);
      if (paymentStatusFilter === "outstanding") return assigned > paid;
      if (paymentStatusFilter === "paid") return hasPaid;
      if (paymentStatusFilter === "fully-paid") return hasPaid && assigned > 0 && paid >= assigned;
      return true;
    });
    if (studentTypeFilter !== "all") {
      result = result.filter((e) => (e.studentType ?? "returning") === studentTypeFilter);
    }
    return result;
  })();

  const handlePrint = () => {
    document.body.classList.add("printing-finance");
    const cleanup = () => {
      document.body.classList.remove("printing-finance");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Safety net for browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 5000);
  };

  const buildExportRows = () => {
    return filteredLedger.map((e, idx) => {
      const tuition = e.tuitionAssigned || 0;
      const paid = e.totalPaid || 0;
      const misc = Math.max(0, paid - tuition);
      const balance = Math.max(0, tuition - paid);
      // Order matches the on-screen table for predictability.
      const row: Record<string, string | number> = { "#": idx + 1 };
      if (isCol("name")) row["Student Name"] = `${e.lastName ?? ""} ${e.firstName ?? ""}`.trim();
      if (isCol("className")) row["Class"] = e.className || "";
      if (isCol("studentId")) row["SOWA ID"] = e.studentId || "";
      if (isCol("studentType")) row["Student Type"] = e.studentType === "new" ? "New" : "Returning";
      if (isCol("parentWhatsapp")) row["Parent WhatsApp"] = e.parentWhatsapp || "";
      if (isCol("tuition")) row["Tuition Fee (NGN)"] = tuition;
      if (isCol("discount")) row["Discount (NGN)"] = e.discount || 0;
      if (isCol("paid")) row[confirmationFiltered ? "Confirmed in range (NGN)" : "Total Paid (NGN)"] = paid;
      if (isCol("misc")) row["Miscellaneous (NGN)"] = misc;
      if (isCol("balance")) row["Balance (NGN)"] = balance;
      if (isCol("status")) row["Status"] = getEntryStatus(e);
      if (isCol("lastPayment")) { row["Last Payment"] = formatLedgerDate(e.lastPaymentDate); row["Last Confirmed (WAT)"] = formatRecordedAt(e.lastConfirmedAt); }
      return row;
    });
  };

  const handleExportExcel = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const className = selectedClassId === "all"
      ? "all-classes"
      : (schoolClasses.find((c) => c.id === selectedClassId)?.name || "class");

    // Append a Grand Total row mirroring the on-screen totals (admin-only).
    if (userRole === "admin" && filteredLedger.length > 0) {
      const totals = filteredLedger.reduce(
        (acc, e) => {
          const tuition = e.tuitionAssigned || 0;
          const paid = e.totalPaid || 0;
          acc.tuition += tuition;
          acc.discount += e.discount || 0;
          acc.tuitionPaid += Math.min(paid, tuition);
          acc.paid += paid;
          acc.misc += Math.max(0, paid - tuition);
          acc.balance += Math.max(0, tuition - paid);
          return acc;
        },
        { tuition: 0, discount: 0, tuitionPaid: 0, paid: 0, misc: 0, balance: 0 },
      );
      const totalRow: Record<string, string | number> = { "#": "" };
      if (isCol("name")) totalRow["Student Name"] = "GRAND TOTAL";
      if (isCol("className")) totalRow["Class"] = "";
      if (isCol("studentId")) totalRow["SOWA ID"] = "";
      if (isCol("parentWhatsapp")) totalRow["Parent WhatsApp"] = "";
      if (isCol("tuition")) totalRow["Tuition Fee (NGN)"] = totals.tuition;
      if (isCol("discount")) totalRow["Discount (NGN)"] = totals.discount;
      if (isCol("paid")) totalRow[confirmationFiltered ? "Confirmed in range (NGN)" : "Total Paid (NGN)"] = totals.paid;
      if (isCol("misc")) totalRow["Miscellaneous (NGN)"] = totals.misc;
      if (isCol("balance")) totalRow["Balance (NGN)"] = totals.balance;
      if (isCol("status")) totalRow["Status"] = "";
      if (isCol("lastPayment")) totalRow["Last Payment"] = "";
      rows.push(totalRow);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Finance");
    if (confirmationFiltered) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Confirmed from (WAT)": confirmedFrom || "Earliest", "Confirmed to (WAT)": confirmedTo || "Latest", "Amounts": "Only payments confirmed in this range" }]), "Confirmation filter");
    const fname = `finance-${sanitizeFilenamePart(schoolName || "school")}-${sanitizeFilenamePart(className)}-${sanitizeFilenamePart(selectedTerm || "all-terms")}-${sanitizeFilenamePart(selectedSession || "all-sessions")}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const printClassName = selectedClassId === "all"
    ? "All Classes"
    : (schoolClasses.find((c) => c.id === selectedClassId)?.name || "—");

  const getStatusBadge = (status: string) => {
    if (status === "confirmed") return <Badge className="bg-green-100 text-green-800 text-[10px]">Confirmed</Badge>;
    if (status === "recorded") return <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Pending</Badge>;
    if (status === "reversed") return <Badge className="bg-red-100 text-red-800 text-[10px]">Reversed</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="finance-mobile space-y-4">
      {/* Print-only header */}
      <div className="hidden print:block mb-3">
        <div className="text-center">
          <div className="text-lg font-bold uppercase tracking-wide">{schoolName || "Seat of Wisdom Academy"}</div>
          <div className="text-sm font-semibold mt-0.5">Finance Summary</div>
          <div className="text-xs mt-1">
            Class: <strong>{printClassName}</strong>
            {" · "}Term: <strong>{selectedTerm || "All"}</strong>
            {" · "}Session: <strong>{selectedSession || "All"}</strong>
          </div>
          <div className="text-[10px] mt-0.5">
            Printed: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

<ConfirmationDateFilter from={confirmedFrom} to={confirmedTo} onApply={(from, to) => { setConfirmedFrom(from); setConfirmedTo(to); setSelectedStudent(null); }} />
      {confirmationFiltered && <p className="text-sm text-muted-foreground" role="status">Confirmed collections · {confirmationRangeLabel(confirmedFrom, confirmedTo)} · Nigerian time. Only amounts confirmed in this range are shown; full-term balances and payment status are hidden.</p>}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex-1 min-w-[180px] sm:flex-none sm:w-56 space-y-1">
          <label className="text-sm font-medium" htmlFor="ledger-payment-status">Payment status</label>
          <Select value={confirmationFiltered ? "all" : paymentStatusFilter}
            onValueChange={value => setPaymentStatusFilter(value as typeof paymentStatusFilter)} disabled={confirmationFiltered}>
            <SelectTrigger id="ledger-payment-status" className="min-h-11" aria-describedby={confirmationFiltered ? "ledger-status-help" : undefined}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="paid">Has Paid</SelectItem>
              <SelectItem value="fully-paid">Tuition Fully Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="min-h-11 sm:hidden" aria-expanded={showAdvancedFilters} aria-controls="ledger-advanced-filters" onClick={() => setShowAdvancedFilters(value => !value)}>Filters</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11 ml-auto">Actions <span aria-hidden="true" className="ml-2">▾</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="min-h-11" onSelect={handlePrint} disabled={!filteredLedger.length}><Printer className="h-4 w-4 mr-2" />Print</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={handleExportExcel} disabled={!filteredLedger.length}><FileSpreadsheet className="h-4 w-4 mr-2" />Export Excel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="min-h-11"><Columns3 className="h-4 w-4 mr-2" />Columns (table / export)</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-[60dvh] overflow-y-auto">
                {COLUMN_DEFS.map(c => <DropdownMenuCheckboxItem key={c.key} className="min-h-11"
                  checked={visibleColumns.has(c.key)} disabled={"required" in c && c.required}
                  onSelect={event => event.preventDefault()} onCheckedChange={() => toggleColumn(c.key)}>{c.label}</DropdownMenuCheckboxItem>)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        {confirmationFiltered && <p id="ledger-status-help" className="w-full text-xs text-muted-foreground">Clear confirmation dates to filter by outstanding or fully paid status.</p>}
      </div>
      <p className="text-sm text-muted-foreground sm:hidden print:hidden">{selectedTerm} · {selectedSession} · {printClassName}</p>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-start sm:items-end print:hidden">
        <div id="ledger-advanced-filters" className={`${showAdvancedFilters ? "flex" : "hidden"} sm:flex w-full sm:w-auto flex-col sm:flex-row sm:flex-wrap gap-3`}>
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs text-muted-foreground font-medium">Term</label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-[140px]">
              <SelectValue placeholder="All terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="First Term">First Term</SelectItem>
              <SelectItem value="Second Term">Second Term</SelectItem>
              <SelectItem value="Third Term">Third Term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs text-muted-foreground font-medium">Session</label>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-[140px]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessionOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs text-muted-foreground font-medium">Class</label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-[160px]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {schoolClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs text-muted-foreground font-medium">Student Type</label>
          <Select value={studentTypeFilter} onValueChange={setStudentTypeFilter}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-[130px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="returning">Returning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or SOWA ID..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
          <Users className="h-4 w-4" />
          <span>{filteredLedger.length} student{filteredLedger.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {ledgerError ? (<p role="alert" className="text-destructive">Could not load confirmed collections. Please refresh to try again.</p>) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filteredLedger.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{ledger.length === 0 ? "No students found for the selected filters." : "No students match your search."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const bannerKey = `${selectedTerm}|${selectedSession}`;
            // Fallback-aware: show the "not configured" banner only when
            // every visible student has 0 tuition AND there is no global or
            // scoped tuition fallback that could supply a value. This still
            // surfaces the banner if scoped rows exist but don't match any
            // student's class.
            const allZeroTuition = ledger.length > 0 && ledger.every((e) => !e.tuitionAssigned);
            const noFallback = !ledgerMeta.hasTuitionFeeType || (!ledgerMeta.hasGlobalTuition && !ledgerMeta.hasScopedTuition);
            const showBanner =
              allZeroTuition &&
              noFallback &&
              tuitionBannerDismissed !== bannerKey;
            if (!showBanner) return null;
            return (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
                <div className="flex-1">
                  <div className="font-medium">Tuition not configured for this term/session</div>
                  <div className="text-xs mt-0.5">
                    No per-class tuition amounts are set for{" "}
                    <strong>{selectedTerm || "all terms"}</strong> ·{" "}
                    <strong>{selectedSession || "all sessions"}</strong>.
                  </div>
                </div>
                {onOpenTuitionSetup && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
                    onClick={onOpenTuitionSetup}
                    data-testid="button-setup-tuition"
                  >
                    Set up tuition
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
                  onClick={() => setTuitionBannerDismissed(bannerKey)}
                  data-testid="button-dismiss-tuition-banner"
                  aria-label="Dismiss"
                >
                  ✕
                </Button>
              </div>
            );
          })()}
          {ledgerMeta.hasTuitionFeeType && ledgerMeta.hasGlobalTuition && !ledgerMeta.hasScopedTuition && selectedTerm && selectedSession && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground print:hidden" data-testid="text-tuition-using-global">
              Using <strong>global tuition defaults</strong> for{" "}
              <strong>{selectedTerm}</strong> · <strong>{selectedSession}</strong>{" "}
              (no term-specific override saved).
            </div>
          )}
          <div className="space-y-3 sm:hidden print:hidden" data-testid="mobile-ledger-cards">
            {filteredLedger.map(entry => <article key={entry.studentDbId} className="rounded-lg border p-3 space-y-3">
              <div className="font-semibold break-words">{entry.lastName} {entry.firstName}{entry.studentType === "new" && <Badge variant="secondary" className="ml-2">New</Badge>}</div>
              <p className="text-sm text-muted-foreground">{entry.className} · {entry.studentId}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt>{confirmationFiltered ? "Confirmed in range" : "Paid"}</dt><dd className="font-semibold text-green-600 break-words">₦{(entry.totalPaid || 0).toLocaleString()}</dd></div>
                {!confirmationFiltered && <div><dt>Outstanding tuition</dt><dd className="font-semibold">₦{Math.max(0, (entry.tuitionAssigned || 0) - (entry.totalPaid || 0)).toLocaleString()}</dd></div>}
              </dl>
              <p className="text-xs text-muted-foreground">Last confirmed: {formatRecordedAt(entry.lastConfirmedAt)}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {!confirmationFiltered && <span className="text-sm">{getEntryStatus(entry)}</span>}
                <Button variant="outline" className="min-h-11" onClick={() => setSelectedStudent(entry)} aria-label={`Payment details for ${entry.lastName} ${entry.firstName}`}>Details</Button>
              </div>
            </article>)}
            {userRole === "admin" && filteredLedger.length > 0 && <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-semibold">Totals for these students</p>
              <p>{confirmationFiltered ? "Confirmed in range" : "Paid"}: ₦{filteredLedger.reduce((sum, e) => sum + (e.totalPaid || 0), 0).toLocaleString()}</p>
              {!confirmationFiltered && <p>Outstanding tuition: ₦{filteredLedger.reduce((sum, e) => sum + Math.max(0, (e.tuitionAssigned || 0) - (e.totalPaid || 0)), 0).toLocaleString()}</p>}
            </div>}
          </div>
          <div className="hidden sm:block print:block rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px] text-center">#</TableHead>
                {isCol("name") && <TableHead>Student Name</TableHead>}
                {isCol("className") && <TableHead>Class</TableHead>}
                {isCol("studentId") && <TableHead>SOWA ID</TableHead>}
                {isCol("studentType") && <TableHead>Type</TableHead>}
                {isCol("parentWhatsapp") && <TableHead>Parent WhatsApp</TableHead>}
                {isCol("tuition") && <TableHead className="text-right">Tuition Fee (₦)</TableHead>}
                {isCol("discount") && <TableHead className="text-right">Discount (₦)</TableHead>}
                {isCol("paid") && <TableHead className="text-right">{confirmationFiltered ? "Confirmed in range (₦)" : "Total Paid (₦)"}</TableHead>}
                {isCol("misc") && <TableHead className="text-right">Miscellaneous (₦)</TableHead>}
                {isCol("balance") && <TableHead className="text-right">Balance (₦)</TableHead>}
                {isCol("status") && <TableHead>Status</TableHead>}
                {isCol("lastPayment") && <TableHead>Payment / Confirmation</TableHead>}
                <TableHead className="w-[50px] print:hidden"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((entry, idx) => {
                const tuition = entry.tuitionAssigned || 0;
                const paid = entry.totalPaid || 0;
                const misc = Math.max(0, paid - tuition);
                const balance = Math.max(0, tuition - paid);
                const prevClass = idx > 0 ? filteredLedger[idx - 1].className : null;
                // When printing "All Classes", insert a class section header
                // before the first row of each class. Hidden on screen.
                const showClassHeader =
                  selectedClassId === "all" && entry.className && entry.className !== prevClass;
                return (
                <Fragment key={entry.studentDbId}>
                {showClassHeader && (
                  <TableRow className="hidden print:table-row" data-print-class-header>
                    <TableCell colSpan={20} className="font-bold bg-gray-200 text-black uppercase tracking-wide text-xs">
                      Class: {entry.className}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className={paid === 0 ? "text-muted-foreground" : ""}>
                  <TableCell className="text-center text-xs">{idx + 1}</TableCell>
                  {isCol("name") && (
                    <TableCell className="font-medium">
                      {entry.lastName} {entry.firstName}
                    </TableCell>
                  )}
                  {isCol("className") && <TableCell className="text-sm">{entry.className}</TableCell>}
                  {isCol("studentId") && <TableCell className="text-sm font-mono">{entry.studentId}</TableCell>}
                  {isCol("studentType") && (
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          (entry.studentType ?? "returning") === "new"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {(entry.studentType ?? "returning") === "new" ? "New" : "Returning"}
                      </span>
                    </TableCell>
                  )}
                  {isCol("parentWhatsapp") && (
                    <TableCell className="text-sm font-mono">{entry.parentWhatsapp || "—"}</TableCell>
                  )}
                  {isCol("tuition") && (
                    <TableCell className="text-right font-semibold">
                      {tuition > 0 ? `₦${tuition.toLocaleString()}` : "—"}
                      {(entry.discount || 0) > 0 && (
                        <div className="text-[10px] font-normal text-emerald-600">
                          -₦{(entry.discount || 0).toLocaleString()} discount applied
                        </div>
                      )}
                    </TableCell>
                  )}
                  {isCol("discount") && (
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {(entry.discount || 0) > 0 ? `₦${(entry.discount || 0).toLocaleString()}` : "—"}
                    </TableCell>
                  )}
                  {isCol("paid") && (
                    <TableCell className={`text-right font-semibold ${paid > 0 ? "text-green-600" : ""}`}>
                      {paid > 0 ? `₦${paid.toLocaleString()}` : "₦0"}
                    </TableCell>
                  )}
                  {isCol("misc") && (
                    <TableCell className="text-right font-semibold text-blue-600">
                      {tuition > 0 || paid > 0 ? `₦${misc.toLocaleString()}` : "—"}
                    </TableCell>
                  )}
                  {isCol("balance") && (
                    <TableCell className={`text-right font-semibold ${balance > 0 ? "text-red-500" : "text-green-600"}`}>
                      {tuition > 0 ? `₦${balance.toLocaleString()}` : "—"}
                    </TableCell>
                  )}
                  {isCol("status") && (
                    <TableCell className="text-sm">{getEntryStatus(entry)}</TableCell>
                  )}
                  {isCol("lastPayment") && (
                    <TableCell className="text-sm">{formatLedgerDate(entry.lastPaymentDate)}<div className="text-xs text-muted-foreground">Confirmed: {formatRecordedAt(entry.lastConfirmedAt)}</div></TableCell>
                  )}
                  <TableCell className="print:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setSelectedStudent(entry)}
                      title="View payment details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                </Fragment>
                );
              })}
              {userRole === 'admin' && filteredLedger.length > 0 && (() => {
                const totals = filteredLedger.reduce(
                  (acc, e) => {
                    const tuition = e.tuitionAssigned || 0;
                    const paid = e.totalPaid || 0;
                    acc.tuition += tuition;
                    acc.discount += e.discount || 0;
                    acc.tuitionPaid += Math.min(paid, tuition);
                    acc.paid += paid;
                    acc.misc += Math.max(0, paid - tuition);
                    acc.balance += Math.max(0, tuition - paid);
                    return acc;
                  },
                  { tuition: 0, discount: 0, tuitionPaid: 0, paid: 0, misc: 0, balance: 0 }
                );
                return (
                  <TableRow
                    className="bg-muted/80 font-bold border-t-2"
                    data-testid="row-ledger-grand-total"
                  >
                    <TableCell></TableCell>
                    {isCol("name") && <TableCell>Grand Total</TableCell>}
                    {isCol("className") && <TableCell></TableCell>}
                    {isCol("studentId") && <TableCell></TableCell>}
                    {isCol("studentType") && <TableCell></TableCell>}
                    {isCol("parentWhatsapp") && <TableCell></TableCell>}
                    {isCol("tuition") && (
                      <TableCell className="text-right" data-testid="cell-grand-total-tuition">
                        <span className="text-green-700">₦{totals.tuitionPaid.toLocaleString()}</span>
                        <span className="text-muted-foreground font-normal"> / </span>
                        <span>₦{totals.tuition.toLocaleString()}</span>
                      </TableCell>
                    )}
                    {isCol("discount") && (
                      <TableCell className="text-right text-emerald-600">₦{totals.discount.toLocaleString()}</TableCell>
                    )}
                    {isCol("paid") && (
                      <TableCell className="text-right text-green-600">₦{totals.paid.toLocaleString()}</TableCell>
                    )}
                    {isCol("misc") && (
                      <TableCell className="text-right text-blue-600">₦{totals.misc.toLocaleString()}</TableCell>
                    )}
                    {isCol("balance") && (
                      <TableCell className={`text-right ${totals.balance > 0 ? "text-red-500" : "text-green-600"}`}>
                        ₦{totals.balance.toLocaleString()}
                      </TableCell>
                    )}
                    {isCol("status") && <TableCell></TableCell>}
                    {isCol("lastPayment") && <TableCell></TableCell>}
                    <TableCell className="print:hidden"></TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="finance-dialog max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStudent ? `${selectedStudent.lastName} ${selectedStudent.firstName}` : ""} — Payment Details
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-2 border-b">
                <span>Class: <strong className="text-foreground">{selectedStudent.className}</strong></span>
                <span>SOWA ID: <strong className="text-foreground font-mono">{selectedStudent.studentId}</strong></span>
                <span>Term: <strong className="text-foreground">{selectedTerm || "All"}</strong></span>
                <span>Session: <strong className="text-foreground">{selectedSession || "All"}</strong></span>
              </div>
              {(() => {
                const totalPaid = selectedStudent.totalPaid || 0;
                if (confirmationFiltered) return <p className="text-sm font-semibold">Confirmed in selected range: ₦{totalPaid.toLocaleString()}</p>;
                const tuitionAssigned = selectedStudent.tuitionAssigned || 0;
                const tuitionPaid = Math.min(totalPaid, tuitionAssigned);
                const nonTuitionPaid = Math.max(0, totalPaid - tuitionAssigned);
                const tuitionOutstanding = Math.max(0, tuitionAssigned - tuitionPaid);
                if (!tuitionAssigned && totalPaid === 0) return null;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-2 border-b" data-testid="fee-breakdown">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Tuition paid</div>
                      <div className="text-base font-semibold text-blue-700" data-testid="text-tuition-paid">
                        ₦{tuitionPaid.toLocaleString()}
                      </div>
                      {tuitionAssigned > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          of ₦{tuitionAssigned.toLocaleString()} assigned
                          {tuitionOutstanding > 0 && (
                            <span className="text-red-500"> · ₦{tuitionOutstanding.toLocaleString()} outstanding</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Non-tuition paid</div>
                      <div className="text-base font-semibold text-amber-700" data-testid="text-nontuition-paid">
                        ₦{nonTuitionPaid.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Other fees &amp; miscellaneous
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Total paid</div>
                      <div className="text-base font-semibold text-green-700" data-testid="text-total-paid">
                        ₦{totalPaid.toLocaleString()}
                      </div>
                      {tuitionAssigned > 0 && totalPaid > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {Math.round((tuitionPaid / totalPaid) * 100)}% tuition · {Math.round((nonTuitionPaid / totalPaid) * 100)}% other
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {recordsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : studentRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No confirmed payments recorded for this term/session.
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount (₦)</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentRecords.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="text-sm">
                            {formatLedgerDate(rec.paymentDate)}
                            <div className="text-xs text-muted-foreground whitespace-nowrap">Recorded: {formatRecordedAt(rec.createdAt)}</div>
                            <div className="text-xs text-muted-foreground">Confirmed: {formatRecordedAt(rec.confirmedAt)}</div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>₦{parseFloat(rec.amount).toLocaleString()}</span>
                              {rec.isSplit && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-blue-700 border-blue-300 bg-blue-50">
                                  split
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{rec.purpose || "—"}</TableCell>
                          <TableCell className="text-sm capitalize">{rec.paymentMethod || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{rec.reference || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(rec.status)}
                              {rec.possibleDuplicate && (
                                <>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-amber-50 text-amber-800 border-amber-400"
                                    title="Same student, same day, same amount as another non-reversed payment."
                                    data-testid={`badge-ledger-possible-duplicate-${rec.id}`}
                                  >
                                    ⚠ Possible duplicate
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[10px] h-6 px-2 mt-1 self-start"
                                    title="Compare both entries side-by-side"
                                    onClick={() => setReviewPair({ kind: 'payment', id: rec.paymentRecordId ?? rec.id })}
                                    data-testid={`button-ledger-review-duplicate-${rec.id}`}
                                  >
                                    Review
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DuplicateReviewSheet
        kind={reviewPair?.kind ?? 'payment'}
        id={reviewPair?.id ?? null}
        open={!!reviewPair}
        onOpenChange={(o) => { if (!o) setReviewPair(null); }}
      />
    </div>
  );
}
