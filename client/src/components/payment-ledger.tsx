import { useState, useEffect } from "react";
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
import { Users, Eye, Search, Loader2 } from "lucide-react";

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
  totalPaid: number;
  totalAssigned: number;
  balance: number;
  paymentCount: number;
  lastPaymentDate: string | null;
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
}

interface PaymentLedgerProps {
  schoolId?: string;
  currentTerm?: string;
  currentSession?: string;
}

export function PaymentLedger({ schoolId, currentTerm, currentSession }: PaymentLedgerProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>(currentTerm || "");
  const [selectedSession, setSelectedSession] = useState<string>(currentSession || "");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<LedgerEntry | null>(null);

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
    enabled: !!schoolId,
  });

  const params = new URLSearchParams();
  if (schoolId) params.set("schoolId", schoolId);
  if (selectedClassId && selectedClassId !== "all") params.set("classId", selectedClassId);
  if (selectedTerm) params.set("term", selectedTerm);
  if (selectedSession) params.set("session", selectedSession);

  const { data: ledger = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["/api/payments/ledger", schoolId, selectedClassId, selectedTerm, selectedSession],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/payments/ledger?${params.toString()}`, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
    enabled: !!schoolId,
  });

  const { data: studentRecords = [], isLoading: recordsLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments/records", schoolId, selectedStudent?.studentDbId, selectedTerm, selectedSession],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = `/api/payments/records?schoolId=${schoolId}&studentId=${selectedStudent!.studentDbId}&status=confirmed` +
        (selectedTerm ? `&term=${encodeURIComponent(selectedTerm)}` : "") +
        (selectedSession ? `&session=${encodeURIComponent(selectedSession)}` : "");
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedStudent && !!schoolId,
  });

  const filteredLedger = nameSearch.trim()
    ? ledger.filter(
        (e) =>
          `${e.lastName} ${e.firstName}`.toLowerCase().includes(nameSearch.toLowerCase()) ||
          e.studentId.toLowerCase().includes(nameSearch.toLowerCase())
      )
    : ledger;

  const grandTotalPaid = filteredLedger.reduce((sum, entry) => sum + entry.totalPaid, 0);
  const grandTotalAssigned = filteredLedger.reduce((sum, entry) => sum + (entry.totalAssigned || 0), 0);
  const grandBalance = filteredLedger.reduce((sum, entry) => sum + (entry.balance || 0), 0);
  const totalPayments = filteredLedger.reduce((sum, entry) => sum + entry.paymentCount, 0);

  const getStatusBadge = (status: string) => {
    if (status === "confirmed") return <Badge className="bg-green-100 text-green-800 text-[10px]">Confirmed</Badge>;
    if (status === "recorded") return <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Pending</Badge>;
    if (status === "reversed") return <Badge className="bg-red-100 text-red-800 text-[10px]">Reversed</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
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

      {isLoading ? (
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
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>SOWA ID</TableHead>
                <TableHead className="text-right">Total Paid (₦)</TableHead>
                <TableHead className="text-right">Balance (₦)</TableHead>
                <TableHead className="text-center">Payments</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((entry, idx) => (
                <TableRow key={entry.studentDbId} className={entry.totalPaid === 0 ? "text-muted-foreground" : ""}>
                  <TableCell className="text-center text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    {entry.lastName} {entry.firstName}
                  </TableCell>
                  <TableCell className="text-sm">{entry.className}</TableCell>
                  <TableCell className="text-sm font-mono">{entry.studentId}</TableCell>
                  <TableCell className={`text-right font-semibold ${entry.totalPaid > 0 ? "text-green-600" : ""}`}>
                    {entry.totalPaid > 0 ? `₦${entry.totalPaid.toLocaleString()}` : "₦0"}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${(entry.balance || 0) > 0 ? "text-red-500" : "text-green-600"}`}>
                    {entry.totalAssigned > 0
                      ? `₦${(entry.balance || 0).toLocaleString()}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">{entry.paymentCount || "0"}</TableCell>
                  <TableCell className="text-sm">
                    {formatLedgerDate(entry.lastPaymentDate)}
                  </TableCell>
                  <TableCell>
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
              ))}
              <TableRow className="bg-muted/80 font-bold border-t-2">
                <TableCell />
                <TableCell>Grand Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right text-green-700">₦{grandTotalPaid.toLocaleString()}</TableCell>
                <TableCell className={`text-right ${grandBalance > 0 ? "text-red-600" : "text-green-700"}`}>
                  {grandTotalAssigned > 0 ? `₦${grandBalance.toLocaleString()}` : "—"}
                </TableCell>
                <TableCell className="text-center">{totalPayments}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-2xl">
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
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ₦{parseFloat(rec.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">{rec.purpose || "—"}</TableCell>
                          <TableCell className="text-sm capitalize">{rec.paymentMethod || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{rec.reference || "—"}</TableCell>
                          <TableCell>{getStatusBadge(rec.status)}</TableCell>
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
    </div>
  );
}
