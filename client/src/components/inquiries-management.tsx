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
import { Inbox, Mail, GraduationCap, Loader2, Eye, Check } from "lucide-react";
import type { ContactSubmission, AdmissionsApplication } from "@shared/schema";

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

export function InquiriesManagement() {
  const [selectedContact, setSelectedContact] = useState<ContactSubmission | null>(null);
  const [selectedApp, setSelectedApp] = useState<AdmissionsApplication | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contactQuery = useQuery<ContactSubmission[]>({
    queryKey: ["/api/admin/contact-submissions"],
  });

  const admissionsQuery = useQuery<AdmissionsApplication[]>({
    queryKey: ["/api/admin/admissions"],
  });

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
  const unreadContacts = contacts.filter((c) => !c.isRead).length;
  const unreadApplications = applications.filter((a) => !a.isRead).length;

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
