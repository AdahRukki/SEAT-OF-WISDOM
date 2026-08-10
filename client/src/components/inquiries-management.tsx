import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Mail, GraduationCap, Loader2, Eye, Check, Briefcase, Download, FileText, Search } from "lucide-react";
import type { ContactSubmission, AdmissionsApplication, TeacherApplication } from "@shared/schema";
import { TEACHER_APPLICATION_STATUSES } from "@shared/schema";

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "N/A";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

const POSITION_LEVELS = ["Nursery", "Primary", "JSS", "SS", "Subject Specialist"];

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "Under Review": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "Shortlisted": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "Interviewed": return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "Hired": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "Rejected": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function csvEscape(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formula injection: applicant-controlled text starting
  // with =, +, -, or @ would otherwise execute as a formula in Excel/Sheets.
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function InquiriesManagement() {
  const [selectedContact, setSelectedContact] = useState<ContactSubmission | null>(null);
  const [selectedApp, setSelectedApp] = useState<AdmissionsApplication | null>(null);
  const [selectedTeacherApp, setSelectedTeacherApp] = useState<TeacherApplication | null>(null);
  const [teacherNotesDraft, setTeacherNotesDraft] = useState("");
  const [taSearch, setTaSearch] = useState("");
  const [taBranch, setTaBranch] = useState("all");
  const [taPosition, setTaPosition] = useState("all");
  const [taSubject, setTaSubject] = useState("all");
  const [taStatus, setTaStatus] = useState("all");
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contactQuery = useQuery<ContactSubmission[]>({
    queryKey: ["/api/admin/contact-submissions"],
  });

  const admissionsQuery = useQuery<AdmissionsApplication[]>({
    queryKey: ["/api/admin/admissions"],
  });

  const teacherAppsQuery = useQuery<TeacherApplication[]>({
    queryKey: ["/api/admin/teacher-applications"],
  });

  const markTeacherAppRead = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      return apiRequest(`/api/admin/teacher-applications/${id}/read`, {
        method: "PATCH",
        body: { isRead },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teacher-applications"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const updateTeacherApp = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status?: string; adminNotes?: string }) => {
      return apiRequest(`/api/admin/teacher-applications/${id}`, {
        method: "PATCH",
        body: { ...(status !== undefined ? { status } : {}), ...(adminNotes !== undefined ? { adminNotes } : {}) },
      });
    },
    onSuccess: (updated: TeacherApplication) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teacher-applications"] });
      setSelectedTeacherApp((prev) => (prev && prev.id === updated.id ? updated : prev));
      toast({ title: "Saved", description: "Application updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const downloadApplicationFile = async (app: TeacherApplication, kind: "cv" | "credentials") => {
    const key = `${app.id}:${kind}`;
    setDownloadingFile(key);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/teacher-applications/${app.id}/file/${kind}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Could not download the file");
      const blob = await res.blob();
      const ext = blob.type.includes("pdf") ? "pdf" : blob.type.includes("word") ? "docx" : "";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${app.fullName.replace(/[^\w\- ]/g, "")} - ${kind === "cv" ? "CV" : "Credentials"}${ext ? "." + ext : ""}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Could not download the file", variant: "destructive" });
    } finally {
      setDownloadingFile(null);
    }
  };

  const markContactRead = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      return apiRequest(`/api/admin/contact-submissions/${id}/read`, {
        method: "PATCH",
        body: { isRead },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-submissions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const markAdmissionRead = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      return apiRequest(`/api/admin/admissions/${id}/read`, {
        method: "PATCH",
        body: { isRead },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admissions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const contacts = contactQuery.data || [];
  const applications = admissionsQuery.data || [];
  const teacherApps = teacherAppsQuery.data || [];
  const unreadContacts = contacts.filter((c) => !c.isRead).length;
  const unreadApplications = applications.filter((a) => !a.isRead).length;
  const unreadTeacherApps = teacherApps.filter((t) => !t.isRead).length;

  const taBranches = Array.from(new Set(teacherApps.map((t) => t.preferredBranch).filter(Boolean))).sort();
  const taSubjects = Array.from(
    new Set(teacherApps.flatMap((t) => [...(t.subjects || []), ...(t.otherSubject ? [t.otherSubject] : [])]))
  ).sort();

  const filteredTeacherApps = teacherApps.filter((t) => {
    if (taBranch !== "all" && t.preferredBranch !== taBranch) return false;
    if (taPosition !== "all" && t.position !== taPosition) return false;
    if (taStatus !== "all" && (t.status || "New") !== taStatus) return false;
    if (taSubject !== "all") {
      const subs = [...(t.subjects || []), ...(t.otherSubject ? [t.otherSubject] : [])];
      if (!subs.includes(taSubject)) return false;
    }
    if (taSearch.trim()) {
      const q = taSearch.trim().toLowerCase();
      const hay = [t.fullName, t.email, t.phone, t.preferredBranch, t.position, ...(t.subjects || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const exportTeacherApps = () => {
    const headers = [
      "Applied", "Full Name", "Phone", "Email", "Position", "Preferred Branch", "Subjects",
      "Years of Experience", "Highest Qualification", "Institution", "Teaching Certification",
      "Availability", "Status", "Notes",
    ];
    const rows = filteredTeacherApps.map((t) => [
      formatDateTime(t.createdAt), t.fullName, t.phone, t.email, t.position, t.preferredBranch,
      [...(t.subjects || []), ...(t.otherSubject ? [t.otherSubject] : [])].join("; "),
      t.yearsOfExperience ?? "", t.highestQualification, t.institution ?? "", t.teachingCertification ?? "",
      t.availabilityDate ?? "", t.status || "New", t.adminNotes ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openTeacherApp = (t: TeacherApplication) => {
    setSelectedTeacherApp(t);
    setTeacherNotesDraft(t.adminNotes || "");
    if (!t.isRead) {
      markTeacherAppRead.mutate({ id: t.id, isRead: true });
    }
  };

  const openContact = (c: ContactSubmission) => {
    setSelectedContact(c);
    if (!c.isRead) {
      markContactRead.mutate({ id: c.id, isRead: true });
    }
  };

  const openApplication = (a: AdmissionsApplication) => {
    setSelectedApp(a);
    if (!a.isRead) {
      markAdmissionRead.mutate({ id: a.id, isRead: true });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Website Inquiries</h2>
        <p className="text-muted-foreground text-sm">Messages and applications submitted through the public website.</p>
      </div>

      <Tabs defaultValue="admissions">
        <TabsList>
          <TabsTrigger value="admissions" data-testid="tab-admissions-apps" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Admissions
            {unreadApplications > 0 && (
              <Badge variant="destructive" className="ml-1">{unreadApplications}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contact-submissions" className="gap-2">
            <Mail className="h-4 w-4" />
            Contact
            {unreadContacts > 0 && (
              <Badge variant="destructive" className="ml-1">{unreadContacts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teacher-applications" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Teacher Applications
            {unreadTeacherApps > 0 && (
              <Badge variant="destructive" className="ml-1">{unreadTeacherApps}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admissions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Admissions Applications
              </CardTitle>
              <CardDescription>
                {applications.length} total &middot; {unreadApplications} unread
              </CardDescription>
            </CardHeader>
            <CardContent>
              {admissionsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No applications yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {applications.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openApplication(a)}
                      data-testid={`row-admission-${a.id}`}
                      className={`w-full text-left py-3 px-2 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3 ${!a.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!a.isRead && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
                          <span className={`font-medium truncate ${!a.isRead ? "" : "text-muted-foreground"}`}>{a.studentName}</span>
                          <Badge variant="outline" className="text-xs">{a.level}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {a.preferredBranch} &middot; Parent: {a.parentName} ({a.parentPhone})
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 text-right">
                        {formatDateTime(a.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Submissions
              </CardTitle>
              <CardDescription>
                {contacts.length} total &middot; {unreadContacts} unread
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contactQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No messages yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openContact(c)}
                      data-testid={`row-contact-${c.id}`}
                      className={`w-full text-left py-3 px-2 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3 ${!c.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!c.isRead && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
                          <span className={`font-medium truncate ${!c.isRead ? "" : "text-muted-foreground"}`}>{c.fullName}</span>
                          <Badge variant="outline" className="text-xs">{c.inquiryType}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {c.email}{c.phone ? ` · ${c.phone}` : ""} &mdash; {c.message.slice(0, 80)}{c.message.length > 80 ? "…" : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 text-right">
                        {formatDateTime(c.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="teachers" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Teacher Job Applications
              </CardTitle>
              <CardDescription>
                {teacherApps.length} total &middot; {unreadTeacherApps} unread
                {filteredTeacherApps.length !== teacherApps.length && <> &middot; {filteredTeacherApps.length} shown</>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, phone..."
                    value={taSearch}
                    onChange={(e) => setTaSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    data-testid="input-teacher-app-search"
                  />
                </div>
                <Select value={taBranch} onValueChange={setTaBranch}>
                  <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-teacher-app-branch">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {taBranches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taPosition} onValueChange={setTaPosition}>
                  <SelectTrigger className="w-[160px] h-9 text-sm" data-testid="select-teacher-app-position">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All positions</SelectItem>
                    {POSITION_LEVELS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taSubject} onValueChange={setTaSubject}>
                  <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-teacher-app-subject">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {taSubjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taStatus} onValueChange={setTaStatus}>
                  <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-teacher-app-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {TEACHER_APPLICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 ml-auto"
                  onClick={exportTeacherApps}
                  disabled={filteredTeacherApps.length === 0}
                  data-testid="button-export-teacher-apps"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              {teacherAppsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTeacherApps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>{teacherApps.length === 0 ? "No applications yet." : "No applications match the current filters."}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTeacherApps.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTeacherApp(t)}
                      data-testid={`row-teacher-app-${t.id}`}
                      className={`w-full text-left py-3 px-2 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3 ${!t.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!t.isRead && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
                          <span className={`font-medium truncate ${!t.isRead ? "" : "text-muted-foreground"}`}>{t.fullName}</span>
                          <Badge variant="outline" className="text-xs">{t.position}</Badge>
                          <Badge className={`text-[10px] ${statusBadgeClasses(t.status || "New")}`}>{t.status || "New"}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {t.preferredBranch} &middot; {t.phone}
                          {(t.subjects || []).length > 0 && <> &middot; {(t.subjects || []).slice(0, 3).join(", ")}{(t.subjects || []).length > 3 ? "…" : ""}</>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 text-right">
                        {formatDateTime(t.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact detail dialog */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Submission</DialogTitle>
            <DialogDescription>{selectedContact && formatDateTime(selectedContact.createdAt)}</DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-3 text-sm">
              <DetailRow label="Full Name" value={selectedContact.fullName} />
              <DetailRow label="Email" value={selectedContact.email} />
              <DetailRow label="Phone" value={selectedContact.phone || "—"} />
              <DetailRow label="Inquiry Type" value={selectedContact.inquiryType} />
              <DetailRow label="Preferred Contact" value={selectedContact.preferredContact || "—"} />
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Message</div>
                <div className="whitespace-pre-wrap bg-muted/40 rounded p-3 text-sm">{selectedContact.message}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedContact?.isRead ? (
              <Button
                variant="outline"
                onClick={() => selectedContact && markContactRead.mutate({ id: selectedContact.id, isRead: false })}
                disabled={markContactRead.isPending}
                data-testid="button-mark-unread-contact"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mark as unread
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => selectedContact && markContactRead.mutate({ id: selectedContact.id, isRead: true })}
                disabled={markContactRead.isPending}
                data-testid="button-mark-read-contact"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark as read
              </Button>
            )}
            <Button onClick={() => setSelectedContact(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admissions detail dialog */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admissions Application</DialogTitle>
            <DialogDescription>{selectedApp && formatDateTime(selectedApp.createdAt)}</DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-3 text-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Student</div>
              <DetailRow label="Full Name" value={selectedApp.studentName} />
              <DetailRow label="Date of Birth" value={selectedApp.dateOfBirth} />
              <DetailRow label="Gender" value={selectedApp.gender} />
              <DetailRow label="Applying for Level" value={selectedApp.level} />
              <DetailRow label="Preferred Branch" value={selectedApp.preferredBranch} />
              <DetailRow label="Previous School" value={selectedApp.previousSchool || "—"} />
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Parent / Guardian</div>
              <DetailRow label="Name" value={selectedApp.parentName} />
              <DetailRow label="Phone" value={selectedApp.parentPhone} />
              <DetailRow label="Email" value={selectedApp.parentEmail || "—"} />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Home Address</div>
                <div className="whitespace-pre-wrap bg-muted/40 rounded p-3">{selectedApp.homeAddress}</div>
              </div>
              {selectedApp.specialNeeds && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Special Needs / Medical</div>
                  <div className="whitespace-pre-wrap bg-muted/40 rounded p-3">{selectedApp.specialNeeds}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedApp?.isRead ? (
              <Button
                variant="outline"
                onClick={() => selectedApp && markAdmissionRead.mutate({ id: selectedApp.id, isRead: false })}
                disabled={markAdmissionRead.isPending}
                data-testid="button-mark-unread-admission"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mark as unread
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => selectedApp && markAdmissionRead.mutate({ id: selectedApp.id, isRead: true })}
                disabled={markAdmissionRead.isPending}
                data-testid="button-mark-read-admission"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark as read
              </Button>
            )}
            <Button onClick={() => setSelectedApp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher application detail dialog */}
      <Dialog open={!!selectedTeacherApp} onOpenChange={(open) => !open && setSelectedTeacherApp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher Application</DialogTitle>
            <DialogDescription>{selectedTeacherApp && formatDateTime(selectedTeacherApp.createdAt)}</DialogDescription>
          </DialogHeader>
          {selectedTeacherApp && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-muted-foreground uppercase w-40 shrink-0">Status</div>
                <Select
                  value={selectedTeacherApp.status || "New"}
                  onValueChange={(v) => updateTeacherApp.mutate({ id: selectedTeacherApp.id, status: v })}
                  disabled={updateTeacherApp.isPending}
                >
                  <SelectTrigger className="w-[180px] h-9" data-testid="select-teacher-app-detail-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHER_APPLICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge className={`${statusBadgeClasses(selectedTeacherApp.status || "New")}`}>{selectedTeacherApp.status || "New"}</Badge>
              </div>
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Personal Information</div>
              <DetailRow label="Full Name" value={selectedTeacherApp.fullName} />
              <DetailRow label="Phone" value={selectedTeacherApp.phone} />
              <DetailRow label="Email" value={selectedTeacherApp.email} />
              <DetailRow label="Date of Birth" value={selectedTeacherApp.dateOfBirth || "—"} />
              <DetailRow label="Gender" value={selectedTeacherApp.gender || "—"} />
              <DetailRow label="Home Address" value={selectedTeacherApp.homeAddress || "—"} />
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Position</div>
              <DetailRow label="Position" value={selectedTeacherApp.position} />
              <DetailRow label="Preferred Branch" value={selectedTeacherApp.preferredBranch} />
              <DetailRow label="Subjects" value={[...(selectedTeacherApp.subjects || []), ...(selectedTeacherApp.otherSubject ? [selectedTeacherApp.otherSubject] : [])].join(", ") || "—"} />
              <DetailRow label="Years of Experience" value={selectedTeacherApp.yearsOfExperience != null ? String(selectedTeacherApp.yearsOfExperience) : "—"} />
              <DetailRow label="Available From" value={selectedTeacherApp.availabilityDate || "—"} />
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Qualifications</div>
              <DetailRow label="Highest Qualification" value={selectedTeacherApp.highestQualification} />
              <DetailRow label="Institution" value={selectedTeacherApp.institution || "—"} />
              <DetailRow label="Teaching Certification" value={selectedTeacherApp.teachingCertification || "—"} />
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedTeacherApp.cvPath || downloadingFile === `${selectedTeacherApp.id}:cv`}
                  onClick={() => downloadApplicationFile(selectedTeacherApp, "cv")}
                  data-testid="button-download-cv"
                >
                  {downloadingFile === `${selectedTeacherApp.id}:cv` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  {selectedTeacherApp.cvPath ? "Download CV" : "No CV uploaded"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedTeacherApp.credentialsPath || downloadingFile === `${selectedTeacherApp.id}:credentials`}
                  onClick={() => downloadApplicationFile(selectedTeacherApp, "credentials")}
                  data-testid="button-download-credentials"
                >
                  {downloadingFile === `${selectedTeacherApp.id}:credentials` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  {selectedTeacherApp.credentialsPath ? "Download Credentials" : "No credentials uploaded"}
                </Button>
              </div>
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Additional Information</div>
              <DetailRow label="Taught Before" value={selectedTeacherApp.taughtBefore || "—"} />
              {selectedTeacherApp.teachingPhilosophy && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Teaching Philosophy</div>
                  <div className="whitespace-pre-wrap bg-muted/40 rounded p-3">{selectedTeacherApp.teachingPhilosophy}</div>
                </div>
              )}
              {selectedTeacherApp.motivation && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Motivation</div>
                  <div className="whitespace-pre-wrap bg-muted/40 rounded p-3">{selectedTeacherApp.motivation}</div>
                </div>
              )}
              <Separator />
              <div className="text-xs font-semibold text-muted-foreground uppercase">Reference</div>
              <DetailRow label="Name" value={selectedTeacherApp.referenceName} />
              <DetailRow label="Phone" value={selectedTeacherApp.referencePhone} />
              <DetailRow label="Relationship" value={selectedTeacherApp.referenceRelationship} />
              <Separator />
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Internal Notes</div>
                <Textarea
                  value={teacherNotesDraft}
                  onChange={(e) => setTeacherNotesDraft(e.target.value)}
                  placeholder="Private notes for admins (interview comments, follow-ups, etc.)"
                  rows={3}
                  data-testid="textarea-teacher-app-notes"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updateTeacherApp.isPending || teacherNotesDraft === (selectedTeacherApp.adminNotes || "")}
                    onClick={() => updateTeacherApp.mutate({ id: selectedTeacherApp.id, adminNotes: teacherNotesDraft })}
                    data-testid="button-save-teacher-app-notes"
                  >
                    {updateTeacherApp.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Save Notes
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedTeacherApp?.isRead ? (
              <Button
                variant="outline"
                onClick={() => selectedTeacherApp && markTeacherAppRead.mutate({ id: selectedTeacherApp.id, isRead: false })}
                disabled={markTeacherAppRead.isPending}
                data-testid="button-mark-unread-teacher-app"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mark as unread
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => selectedTeacherApp && markTeacherAppRead.mutate({ id: selectedTeacherApp.id, isRead: true })}
                disabled={markTeacherAppRead.isPending}
                data-testid="button-mark-read-teacher-app"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark as read
              </Button>
            )}
            <Button onClick={() => setSelectedTeacherApp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="text-xs font-medium text-muted-foreground uppercase w-40 shrink-0 pt-0.5">{label}</div>
      <div className="flex-1 break-words">{value}</div>
    </div>
  );
}
