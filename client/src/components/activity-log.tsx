// Task #215: Full activity audit log viewer (read-only).
// Main admin sees all schools; sub-admins are scoped server-side to their school.
import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { History, ChevronDown, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";

interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string;
  userName: string;
  userRole: string;
  schoolId: string | null;
  schoolName: string | null;
  previousData: any;
  newData: any;
  createdAt: string;
}

interface ActivityLogResponse {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_LABELS: Record<string, string> = {
  // Scores
  update_scores: "Updated scores (bulk)",
  save_score: "Saved score",
  delete_score: "Deleted score",
  upload_scores: "Uploaded scores (Excel)",
  // Students
  create_student: "Created student",
  update_student: "Edited student",
  student_status_active: "Activated student",
  student_status_inactive: "Deactivated student",
  student_status_withdrawn: "Withdrew student",
  student_status_graduated: "Graduated student",
  withdraw_students: "Withdrew students",
  promote_students: "Promoted students",
  bulk_promote_students: "Bulk-promoted students",
  batch_upload_students: "Batch-uploaded students",
  graduate_students: "Graduated students",
  rollback_student_classes: "Rolled back promotions",
  // Finance (legacy + current payment audit actions)
  record_payment: "Recorded payment",
  confirm_payment: "Confirmed payment",
  unconfirm_payment: "Un-confirmed payment",
  reverse_payment: "Reversed payment",
  reverse_as_duplicate: "Reversed as duplicate",
  clear_duplicate_flag: "Cleared duplicate flag",
  mark_transaction_ignored_duplicate: "Ignored duplicate transaction",
  rescan_flag_transaction: "Flagged duplicate (re-scan)",
  rescan_statement_duplicates: "Re-scanned statement duplicates",
  allocate: "Allocated bank credit",
  upload_statement: "Uploaded bank statement",
  delete_statement: "Deleted bank statement",
  // System
  create_user: "Created user",
  create_sub_admin: "Created sub-admin",
  create_main_admin: "Created main admin",
  update_user: "Edited user",
  delete_user: "Deleted user",
  update_user_permissions: "Changed permissions",
  change_user_password: "Changed password",
  advance_term: "Advanced term",
  activate_term: "Activated term",
  activate_session: "Activated session",
  set_school_academic_info: "Set school term/session",
  create_session: "Created session",
  create_term: "Created term",
  initialize_academic_calendar: "Initialized academic calendar",
  update_school: "Edited school details",
  update_school_logo: "Updated school logo",
  update_school_signature: "Updated principal signature",
  create_class: "Created class",
  delete_class: "Deleted class",
  reorder_classes: "Reordered classes",
  update_class_settings: "Changed class settings",
  create_subject: "Created subject",
  update_subject: "Renamed subject",
  assign_subject_to_class: "Assigned subject to class",
  remove_subject_from_class: "Removed subject from class",
  rename_class_subject: "Renamed class subject",
  publish_scores: "Published scores",
  unpublish_scores: "Un-published scores",
  update_student_photo: "Updated student photo",
  update_own_profile: "Edited own profile",
  change_own_password: "Changed own password",
  save_non_academic_rating: "Saved behaviour rating",
  update_academy_logo: "Updated academy logo",
  update_tuition_amounts: "Updated tuition amounts",
  assign_student_fee: "Assigned fee to student",
  assign_fee_to_class: "Assigned fee to class",
  create_fee_type: "Created fee type",
  update_fee_type: "Edited fee type",
  delete_fee_type: "Deleted fee type",
  create_bank_account: "Added bank account mapping",
  update_bank_account: "Edited bank account mapping",
  delete_bank_account: "Deleted bank account mapping",
  // Report cards
  generate_report_card: "Generated report card",
  regenerate_report_card: "Re-generated report card",
  clear_report_cards: "Cleared report cards",
  delete_report_card: "Deleted report card",
};

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  assessment: { label: "Scores", className: "bg-blue-100 text-blue-800" },
  score: { label: "Scores", className: "bg-blue-100 text-blue-800" },
  student: { label: "Students", className: "bg-green-100 text-green-800" },
  payment_record: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  payment: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  bank_transaction: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  bank_statement: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  allocation: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  bank_account: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  fee_type: { label: "Finance", className: "bg-amber-100 text-amber-800" },
  class: { label: "System", className: "bg-purple-100 text-purple-800" },
  subject: { label: "System", className: "bg-purple-100 text-purple-800" },
  user: { label: "System", className: "bg-purple-100 text-purple-800" },
  term: { label: "System", className: "bg-purple-100 text-purple-800" },
  session: { label: "System", className: "bg-purple-100 text-purple-800" },
  school: { label: "System", className: "bg-purple-100 text-purple-800" },
  report_card: { label: "System", className: "bg-purple-100 text-purple-800" },
};

function formatAction(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function JsonBlock({ title, data }: { title: string; data: any }) {
  if (data === null || data === undefined) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold mb-1 text-muted-foreground">{title}</p>
      <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto max-h-56 whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function ActivityLog() {
  const { user } = useAuth();
  const isMainAdmin = user?.role === "admin";

  const [schoolId, setSchoolId] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 25;

  const resetPage = () => setPage(1);

  // Schools list for the school filter (main admin only)
  const { data: schools } = useQuery<any[]>({
    queryKey: ["/api/admin/schools"],
    queryFn: () => apiRequest("/api/admin/schools"),
    enabled: isMainAdmin,
  });

  // Users list for the "who did it" filter. Sub-admins without the Users tab
  // permission get a 403 — fail silently and hide the filter in that case.
  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users", "activity-log-filter"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/admin/users");
      } catch {
        return [];
      }
    },
    retry: false,
  });
  const staffUsers = (allUsers || []).filter((u: any) => u.role !== "student");

  const params = new URLSearchParams();
  if (isMainAdmin && schoolId !== "all") params.set("schoolId", schoolId);
  if (actionType !== "all") params.set("actionType", actionType);
  if (userFilter !== "all") params.set("userId", userFilter);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const { data, isLoading, error } = useQuery<ActivityLogResponse>({
    queryKey: ["/api/admin/activity-logs", schoolId, actionType, userFilter, dateFrom, dateTo, page],
    queryFn: () => apiRequest(`/api/admin/activity-logs?${params.toString()}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Card data-testid="card-activity-log">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          A read-only record of who changed what and when — scores, students, finance, and system actions
          {!isMainAdmin && " (your school only)"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {isMainAdmin && (
            <div>
              <Label className="text-xs">School</Label>
              <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); resetPage(); }}>
                <SelectTrigger className="h-9" data-testid="select-activity-school">
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {(schools || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Action type</Label>
            <Select value={actionType} onValueChange={(v) => { setActionType(v); resetPage(); }}>
              <SelectTrigger className="h-9" data-testid="select-activity-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="scores">Scores</SelectItem>
                <SelectItem value="students">Students</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {staffUsers.length > 0 && (
            <div>
              <Label className="text-xs">User</Label>
              <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); resetPage(); }}>
                <SelectTrigger className="h-9" data-testid="select-activity-user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {staffUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              className="h-9"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
              data-testid="input-activity-date-from"
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              className="h-9"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
              data-testid="input-activity-date-to"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10 text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">Failed to load the activity log.</p>
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No activity found for the selected filters.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[30px]" />
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.map((log) => {
                  const cat = CATEGORY_BADGE[log.entityType] || { label: log.entityType, className: "bg-gray-100 text-gray-800" };
                  const expanded = expandedId === log.id;
                  const hasDetails = log.previousData != null || log.newData != null;
                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        className={hasDetails ? "cursor-pointer hover:bg-muted/40" : undefined}
                        onClick={() => hasDetails && setExpandedId(expanded ? null : log.id)}
                        data-testid={`row-activity-${log.id}`}
                      >
                        <TableCell className="px-2">
                          {hasDetails && (expanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{log.userName}</TableCell>
                        <TableCell className="text-xs capitalize">{log.userRole}</TableCell>
                        <TableCell className="text-xs">{log.schoolName || "All / system"}</TableCell>
                        <TableCell>
                          <Badge className={`${cat.className} text-[10px]`}>{cat.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatAction(log.action)}</TableCell>
                      </TableRow>
                      {expanded && hasDetails && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
                              <JsonBlock title="Before" data={log.previousData} />
                              <JsonBlock title="After" data={log.newData} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {data.total} entries · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-activity-prev"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-activity-next"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
