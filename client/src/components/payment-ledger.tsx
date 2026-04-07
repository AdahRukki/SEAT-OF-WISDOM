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
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

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

interface PaymentLedgerProps {
  schoolId?: string;
  currentTerm?: string;
  currentSession?: string;
}

export function PaymentLedger({ schoolId, currentTerm, currentSession }: PaymentLedgerProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>(currentTerm || "");
  const [selectedSession, setSelectedSession] = useState<string>(currentSession || "");

  useEffect(() => {
    if (currentTerm) setSelectedTerm(currentTerm);
  }, [currentTerm]);
  useEffect(() => {
    if (currentSession) setSelectedSession(currentSession);
  }, [currentSession]);

  const { data: sessions = [] } = useQuery<{ id: string; name: string }[]>({
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

  const grandTotalPaid = ledger.reduce((sum, entry) => sum + entry.totalPaid, 0);
  const grandTotalAssigned = ledger.reduce((sum, entry) => sum + (entry.totalAssigned || 0), 0);
  const grandBalance = ledger.reduce((sum, entry) => sum + (entry.balance || 0), 0);
  const totalPayments = ledger.reduce((sum, entry) => sum + entry.paymentCount, 0);

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
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
          <Users className="h-4 w-4" />
          <span>{ledger.length} student{ledger.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No students found for the selected filters.</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry, idx) => (
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
                    {entry.lastPaymentDate
                      ? new Date(entry.lastPaymentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
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
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
