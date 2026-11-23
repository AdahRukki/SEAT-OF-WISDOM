import { formatStudentName } from "@shared/student-name";
import { AdminMenuButton } from "@/components/admin-sidebar";
import { useMemo, useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  Users,
  UserPlus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  ArrowLeft,
  User as UserIcon,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import logoImage from "@assets/4oWHptM_1754171230437.gif";
import type { User, School as SchoolType } from "@shared/schema";

type TeacherDraft = { firstName: string; lastName: string; email: string; password: string; schoolId: string; assignedClassId: string };
const emptyTeacherDraft = (schoolId = ""): TeacherDraft => ({ firstName: "", lastName: "", email: "", password: "", schoolId, assignedClassId: "" });

export default function UserManagement() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for dialogs
  const [isCreateSubAdminDialogOpen, setIsCreateSubAdminDialogOpen] = useState(false);
  const [isCreateMainAdminDialogOpen, setIsCreateMainAdminDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<User | null>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  
  // Form states for admin creation
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [teacherForm, setTeacherForm] = useState({ firstName: "", lastName: "", email: "", password: "", schoolId: "", assignedClassId: "" });
  const [isCreateTeacherOpen, setIsCreateTeacherOpen] = useState(false);
  const [batchTeacherRows, setBatchTeacherRows] = useState<TeacherDraft[]>([emptyTeacherDraft()]);
  const [isBatchCreateOpen, setIsBatchCreateOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchEditRows, setBatchEditRows] = useState<Array<TeacherDraft & { id: string; isActive: boolean }>>([]);
  const [selectedBatchEditIds, setSelectedBatchEditIds] = useState<Set<string>>(new Set());
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Edit user form states
  const [editUserForm, setEditUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    schoolId: "",
    assignedClassId: "",
    isActive: true,
    password: "",
    confirmPassword: "",
    changePassword: false
  });

  // Queries - Filter to show only admin and sub-admin users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users?adminOnly=true'],
    enabled: user?.role === 'admin'
  });

  const { data: schools = [] } = useQuery<SchoolType[]>({
    queryKey: ['/api/admin/schools'],
    enabled: user?.role === 'admin'
  });

  const classQueries = useQueries({ queries: schools.map(school => ({
    queryKey: ['/api/admin/classes', school.id],
    queryFn: () => apiRequest(`/api/admin/classes?schoolId=${encodeURIComponent(school.id)}`),
    enabled: user?.role === 'admin',
  })) });
  const classesBySchool = useMemo(() => Object.fromEntries(schools.map((school, index) => [
    school.id, (classQueries[index]?.data ?? []) as Array<{ id: string; name: string }>
  ])), [schools, classQueries]);

  const { data: teacherClasses = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/admin/classes', teacherForm.schoolId],
    queryFn: () => apiRequest(`/api/admin/classes?schoolId=${encodeURIComponent(teacherForm.schoolId)}`),
    enabled: user?.role === 'admin' && !!teacherForm.schoolId,
  });

  const { data: editTeacherClasses = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/admin/classes', editUserForm.schoolId],
    queryFn: () => apiRequest(`/api/admin/classes?schoolId=${encodeURIComponent(editUserForm.schoolId)}`),
    enabled: user?.role === 'admin' && isEditUserDialogOpen && selectedUser?.role === 'teacher' && !!editUserForm.schoolId,
  });

  const createTeacherMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/users', {
      method: 'POST',
      body: { ...teacherForm, role: 'teacher' },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateTeacherOpen(false);
      setTeacherForm({ firstName: "", lastName: "", email: "", password: "", schoolId: "", assignedClassId: "" });
      toast({ title: 'Teacher account created' });
    },
    onError: (error: any) => toast({ title: 'Unable to create teacher', description: error.message, variant: 'destructive' }),
  });

  const batchTeacherMutation = useMutation({
    mutationFn: (payload: { mode: 'create' | 'edit'; rows: any[] }) => apiRequest('/api/admin/teachers/batch', { method: 'POST', body: payload }),
    onSuccess: (result: { succeeded: number; failed: number; results: Array<{ index: number; ok: boolean; error?: string }> }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      const failures = result.results.filter(row => !row.ok).map(row => `Row ${row.index + 1}: ${row.error}`).join(' · ');
      toast({ title: `${result.succeeded} teacher account(s) saved${result.failed ? `; ${result.failed} failed` : ''}`, description: failures || undefined, variant: result.failed ? 'destructive' : 'default' });
      if (variables.mode === 'create' && result.failed) {
        const failedIndexes = new Set(result.results.filter(row => !row.ok).map(row => row.index));
        setBatchTeacherRows(variables.rows.filter((_, index) => failedIndexes.has(index)));
      }
      if (variables.mode === 'edit') {
        const succeededIds = new Set(result.results.filter(row => row.ok).map(row => variables.rows[row.index]?.id).filter(Boolean));
        setSelectedBatchEditIds(prev => new Set(Array.from(prev).filter(id => !succeededIds.has(id))));
      }
      if (result.failed === 0) {
        setBatchTeacherRows([emptyTeacherDraft()]);
        setIsBatchCreateOpen(false);
        setIsCreateTeacherOpen(false);
        setIsBatchEditOpen(false);
        setSelectedBatchEditIds(new Set());
      }
    },
    onError: (error: any) => toast({ title: 'Batch update failed', description: error.message, variant: 'destructive' }),
  });

  // Create sub-admin mutation
  const createSubAdminMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      schoolId: string;
    }) => {
      return apiRequest('/api/admin/create-sub-admin', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Sub-Admin Created",
        description: "New sub-administrator has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateSubAdminDialogOpen(false);
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setSelectedSchoolId("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create sub-admin. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create main admin mutation
  const createMainAdminMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      return apiRequest('/api/admin/create-main-admin', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Main Admin Created",
        description: "New main administrator has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateMainAdminDialogOpen(false);
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create main admin. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/admin/users/${data.id}`, {
        method: 'PATCH',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsDeleteUserDialogOpen(false);
      setSelectedUserForDeletion(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-600';
      case 'sub-admin': return 'bg-purple-600';
      case 'teacher': return 'bg-emerald-600';
      default: return 'bg-gray-600';
    }
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || 'Unknown School';
  };

  const teacherUsers = useMemo(() => users.filter(account => account.role === 'teacher'), [users]);
  const sortedUsers = useMemo(() => [...users].sort((a, b) =>
    (a.lastName || '').localeCompare(b.lastName || '', undefined, { sensitivity: 'base' }) ||
    (a.firstName || '').localeCompare(b.firstName || '', undefined, { sensitivity: 'base' }) ||
    a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
  ), [users]);
  const openBatchEdit = () => {
    setBatchEditRows(teacherUsers.map(account => ({
      id: account.id, firstName: account.firstName, lastName: account.lastName, email: account.email,
      password: '', schoolId: account.schoolId || '', assignedClassId: account.assignedClassId || '', isActive: account.isActive ?? true,
    })));
    setSelectedBatchEditIds(new Set());
    setIsBatchEditOpen(true);
  };

  const openEditUser = (userData: User) => {
    setSelectedUser(userData);
    setEditUserForm({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      schoolId: userData.schoolId || "",
      assignedClassId: userData.assignedClassId || "",
      isActive: userData.isActive ?? true,
      password: "",
      confirmPassword: "",
      changePassword: false
    });
    setIsEditUserDialogOpen(true);
  };

  // Access control - only main admins can access user management
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Users className="w-6 h-6" />
              Access Denied
            </CardTitle>
            <CardDescription>
              User management is only available to main administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You do not have permission to access this page. Please contact a main administrator if you need assistance.
            </p>
            <Button
              onClick={() => window.history.back()}
              className="w-full"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Left side - Logo and Brand */}
              <div className="flex items-center space-x-4">
                <AdminMenuButton />
                <a href="/" className="flex items-center space-x-3">
                  <img src={logoImage} alt="Seat of Wisdom Academy" className="h-10 w-10 rounded-full" />
                  <div className="hidden sm:block">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">SOWA Admin Portal</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">User Management</p>
                  </div>
                </a>
              </div>

              {/* Right side - User Actions */}
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.history.back()}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                </Button>
                
                <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden md:inline">{user?.firstName} {user?.lastName}</span>
                  <span className="md:hidden text-xs">{user?.firstName}</span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline sm:ml-2">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage admin accounts and create sub-administrators for schools
            </p>
          </div>

          <div className="space-y-6">
            {/* Actions Bar */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className="text-lg font-semibold">
                  {users.length} Accounts · {teacherUsers.length} Teachers
                </span>
              </div>
              <div className="flex gap-2">
                <Dialog open={isCreateMainAdminDialogOpen} onOpenChange={setIsCreateMainAdminDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Main Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Main Administrator</DialogTitle>
                      <DialogDescription>
                        Create a new main admin with full system access
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="main-firstName">First Name</Label>
                          <Input
                            id="main-firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="main-lastName">Last Name</Label>
                          <Input
                            id="main-lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter last name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="main-email">Email</Label>
                        <Input
                          id="main-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="main-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="main-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="outline"
                        onClick={() => setIsCreateMainAdminDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createMainAdminMutation.mutate({ firstName, lastName, email, password })}
                        disabled={!firstName || !lastName || !email || !password || createMainAdminMutation.isPending}
                      >
                        {createMainAdminMutation.isPending ? "Creating..." : "Create Main Admin"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCreateTeacherOpen} onOpenChange={setIsCreateTeacherOpen}>
                  <DialogTrigger asChild><Button variant="outline"><UserPlus className="w-4 h-4 mr-2" />Add Teacher</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Teacher</DialogTitle><DialogDescription>Teachers can view their assigned class and enter scores. They cannot add students or edit names.</DialogDescription></DialogHeader>
                    <div className="grid gap-3 py-4">
                      {(['firstName', 'lastName', 'email', 'password'] as const).map(field => <div key={field}>
                        <Label htmlFor={`teacher-${field}`}>{({ firstName: 'First Name', lastName: 'Last Name', email: 'Email', password: 'Password' })[field]}</Label>
                        <Input id={`teacher-${field}`} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} value={teacherForm[field]} onChange={e => setTeacherForm(prev => ({ ...prev, [field]: e.target.value }))} />
                      </div>)}
                      <Label htmlFor="teacher-school">School</Label>
                      <select id="teacher-school" className="border rounded p-2" value={teacherForm.schoolId} onChange={e => setTeacherForm(prev => ({ ...prev, schoolId: e.target.value, assignedClassId: '' }))}>
                        <option value="">Select school</option>
                        {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                      </select>
                      <Label htmlFor="teacher-class">Assigned class</Label>
                      <select id="teacher-class" className="border rounded p-2" value={teacherForm.assignedClassId} disabled={!teacherForm.schoolId} onChange={e => setTeacherForm(prev => ({ ...prev, assignedClassId: e.target.value }))}>
                        <option value="">Select class</option>
                        {teacherClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                      </select>
                    </div>
                    <Button disabled={createTeacherMutation.isPending || Object.values(teacherForm).some(value => !value.trim())} onClick={() => createTeacherMutation.mutate()}>{createTeacherMutation.isPending ? 'Creating...' : 'Create Teacher'}</Button>
                  </DialogContent>
                </Dialog>

                <Dialog open={isBatchCreateOpen} onOpenChange={(open) => { setIsBatchCreateOpen(open); if (open) setBatchTeacherRows([emptyTeacherDraft()]); }}>
                  <DialogTrigger asChild><Button variant="outline"><Users className="w-4 h-4 mr-2" />Batch Create Teachers</Button></DialogTrigger>
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Batch Create Teacher Accounts</DialogTitle><DialogDescription>Add several teachers at once. Each row needs its own login, school, class, and password. Failed rows will be listed so you can correct and resubmit them.</DialogDescription></DialogHeader>
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>First name</TableHead><TableHead>Last name</TableHead><TableHead>Email / username</TableHead><TableHead>Password</TableHead><TableHead>School</TableHead><TableHead>Assigned class</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>{batchTeacherRows.map((row, index) => <TableRow key={index}>
                          <TableCell><Input value={row.firstName} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, firstName: e.target.value } : item))} /></TableCell>
                          <TableCell><Input value={row.lastName} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, lastName: e.target.value } : item))} /></TableCell>
                          <TableCell><Input type="email" value={row.email} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} /></TableCell>
                          <TableCell><Input type="password" value={row.password} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, password: e.target.value } : item))} /></TableCell>
                          <TableCell><select className="min-w-40 border rounded p-2 bg-background" value={row.schoolId} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, schoolId: e.target.value, assignedClassId: '' } : item))}><option value="">Select school</option>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></TableCell>
                          <TableCell><select className="min-w-36 border rounded p-2 bg-background" value={row.assignedClassId} disabled={!row.schoolId} onChange={e => setBatchTeacherRows(prev => prev.map((item, i) => i === index ? { ...item, assignedClassId: e.target.value } : item))}><option value="">Select class</option>{(classesBySchool[row.schoolId] || []).map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></TableCell>
                          <TableCell><Button variant="ghost" size="sm" disabled={batchTeacherRows.length === 1} onClick={() => setBatchTeacherRows(prev => prev.filter((_, i) => i !== index))}>Remove</Button></TableCell>
                        </TableRow>)}</TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between"><Button variant="outline" disabled={batchTeacherRows.length >= 100} onClick={() => setBatchTeacherRows(prev => [...prev, emptyTeacherDraft()])}>Add row</Button>
                      <Button disabled={batchTeacherMutation.isPending || batchTeacherRows.some(row => Object.values(row).some(value => !value.trim()))} onClick={() => batchTeacherMutation.mutate({ mode: 'create', rows: batchTeacherRows })}>{batchTeacherMutation.isPending ? 'Saving…' : `Create ${batchTeacherRows.length} account(s)`}</Button></div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isBatchEditOpen} onOpenChange={setIsBatchEditOpen}>
                  <Button variant="outline" disabled={!teacherUsers.length} onClick={openBatchEdit}>Batch Edit Teachers</Button>
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Batch Edit Teacher Accounts</DialogTitle><DialogDescription>Select the teachers to save. Leave a password blank to keep it unchanged. Changes are saved row by row, with any failures reported.</DialogDescription></DialogHeader>
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>First name</TableHead><TableHead>Last name</TableHead><TableHead>Email / username</TableHead><TableHead>New password</TableHead><TableHead>School</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>{batchEditRows.map((row, index) => <TableRow key={row.id}><TableCell><input type="checkbox" checked={selectedBatchEditIds.has(row.id)} onChange={e => setSelectedBatchEditIds(prev => { const next = new Set(prev); e.target.checked ? next.add(row.id) : next.delete(row.id); return next; })} /></TableCell>
                        {(['firstName', 'lastName', 'email', 'password'] as const).map(field => <TableCell key={field}><Input type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} value={row[field]} onChange={e => setBatchEditRows(prev => prev.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} /></TableCell>)}
                        <TableCell><select className="min-w-40 border rounded p-2 bg-background" value={row.schoolId} onChange={e => setBatchEditRows(prev => prev.map((item, i) => i === index ? { ...item, schoolId: e.target.value, assignedClassId: '' } : item))}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></TableCell>
                        <TableCell><select className="min-w-36 border rounded p-2 bg-background" value={row.assignedClassId} onChange={e => setBatchEditRows(prev => prev.map((item, i) => i === index ? { ...item, assignedClassId: e.target.value } : item))}>{(classesBySchool[row.schoolId] || []).map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></TableCell>
                        <TableCell><select className="border rounded p-2 bg-background" value={row.isActive ? 'active' : 'inactive'} onChange={e => setBatchEditRows(prev => prev.map((item, i) => i === index ? { ...item, isActive: e.target.value === 'active' } : item))}><option value="active">Active</option><option value="inactive">Inactive</option></select></TableCell>
                      </TableRow>)}</TableBody></Table></div>
                    <div className="flex justify-between items-center"><label className="text-sm"><input type="checkbox" checked={batchEditRows.length > 0 && selectedBatchEditIds.size === batchEditRows.length} onChange={e => setSelectedBatchEditIds(e.target.checked ? new Set(batchEditRows.map(row => row.id)) : new Set())} /> Select all ({selectedBatchEditIds.size} selected)</label>
                      <Button disabled={!selectedBatchEditIds.size || batchTeacherMutation.isPending} onClick={() => batchTeacherMutation.mutate({ mode: 'edit', rows: batchEditRows.filter(row => selectedBatchEditIds.has(row.id)) })}>{batchTeacherMutation.isPending ? 'Saving…' : `Save selected (${selectedBatchEditIds.size})`}</Button></div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCreateSubAdminDialogOpen} onOpenChange={setIsCreateSubAdminDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Sub-Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Sub-Administrator</DialogTitle>
                      <DialogDescription>
                        Create a new sub-admin who will manage a specific school branch
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter last name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="school">Assign to School</Label>
                        <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a school" />
                          </SelectTrigger>
                          <SelectContent>
                            {schools.map(school => (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="outline"
                        onClick={() => setIsCreateSubAdminDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createSubAdminMutation.mutate({ firstName, lastName, email, password, schoolId: selectedSchoolId })}
                        disabled={!firstName || !lastName || !email || !password || !selectedSchoolId || createSubAdminMutation.isPending}
                      >
                        {createSubAdminMutation.isPending ? "Creating..." : "Create Sub-Admin"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {formatStudentName(user)}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.schoolId ? getSchoolName(user.schoolId) : 'All Schools'}
                        </TableCell>
                        <TableCell>{user.role === 'teacher' ? (classesBySchool[user.schoolId || ''] || []).find(cls => cls.id === user.assignedClassId)?.name || '—' : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setIsProfileDialogOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View user profile</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditUser(user)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit user details</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            {/* Delete button - Only show for non-admin users */}
                            {user.role !== 'admin' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserForDeletion(user);
                                      setIsDeleteUserDialogOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete this user account</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* User Profile Dialog */}
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
              <DialogDescription>
                View detailed user information
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                    <p className="text-base">{formatStudentName(selectedUser)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-base">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                    <Badge className={`${getRoleBadgeColor(selectedUser.role)} text-white`}>
                      {selectedUser.role}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">School</Label>
                    <p className="text-base">
                      {selectedUser.schoolId ? getSchoolName(selectedUser.schoolId) : 'All Schools'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <Badge variant={selectedUser.isActive ? 'default' : 'secondary'}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                    <p className="text-base">
                      {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user account information and settings
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input
                    id="edit-firstName"
                    data-testid="input-edit-firstName"
                    value={editUserForm.firstName}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input
                    id="edit-lastName"
                    data-testid="input-edit-lastName"
                    value={editUserForm.lastName}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              {/* Email and School */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-email">Email Address</Label>
                  <Input
                    id="edit-email"
                    data-testid="input-edit-email"
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-school">School Assignment</Label>
                  <Select
                    value={editUserForm.schoolId || "all"}
                    onValueChange={(value) => setEditUserForm(prev => ({ ...prev, schoolId: value === "all" ? "" : value, assignedClassId: prev.schoolId === value ? prev.assignedClassId : "" }))}
                  >
                    <SelectTrigger data-testid="select-edit-school">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schools (Admin)</SelectItem>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedUser?.role === 'teacher' && (
                <div>
                  <Label htmlFor="edit-teacher-class">Assigned Class</Label>
                  <select id="edit-teacher-class" className="w-full border rounded p-2" value={editUserForm.assignedClassId}
                    disabled={!editUserForm.schoolId}
                    onChange={e => setEditUserForm(prev => ({ ...prev, assignedClassId: e.target.value }))}>
                    <option value="">Select class</option>
                    {editTeacherClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Teachers can view students and edit scores only. They cannot add students or change names.</p>
                </div>
              )}

              {/* Account Status */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active-status"
                  data-testid="switch-edit-active"
                  checked={editUserForm.isActive}
                  onCheckedChange={(checked) => setEditUserForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="edit-active-status">Account is active</Label>
              </div>

              {/* Password Change Section - Only for main admins */}
              {user?.role === 'admin' && (
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-2 mb-3">
                    <Switch
                      id="change-password"
                      data-testid="switch-change-password"
                      checked={editUserForm.changePassword}
                      onCheckedChange={(checked) => setEditUserForm(prev => ({ 
                        ...prev, 
                        changePassword: checked,
                        password: checked ? prev.password : "",
                        confirmPassword: checked ? prev.confirmPassword : ""
                      }))}
                    />
                    <Label htmlFor="change-password" className="text-sm font-medium">
                      Change user password
                    </Label>
                  </div>

                  {editUserForm.changePassword && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="edit-new-password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="edit-new-password"
                            data-testid="input-edit-new-password"
                            type={showEditPassword ? "text" : "password"}
                            value={editUserForm.password}
                            onChange={(e) => setEditUserForm(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter new password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                          >
                            {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-confirm-password">Confirm New Password</Label>
                        <div className="relative">
                          <Input
                            id="edit-confirm-password"
                            data-testid="input-edit-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={editUserForm.confirmPassword}
                            onChange={(e) => setEditUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm new password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline"
                onClick={() => {
                  setIsEditUserDialogOpen(false);
                  setSelectedUser(null);
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editUserForm.changePassword && editUserForm.password !== editUserForm.confirmPassword) {
                    toast({
                      title: "Password Mismatch",
                      description: "The new password and confirmation password do not match.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const updateData = {
                    id: selectedUser?.id,
                    firstName: editUserForm.firstName,
                    lastName: editUserForm.lastName,
                    email: editUserForm.email,
                    schoolId: editUserForm.schoolId || null,
                    ...(selectedUser?.role === 'teacher' ? { assignedClassId: editUserForm.assignedClassId || null } : {}),
                    isActive: editUserForm.isActive,
                    ...(editUserForm.changePassword && editUserForm.password && {
                      password: editUserForm.password
                    })
                  };
                  
                  editUserMutation.mutate(updateData);
                }}
                disabled={editUserMutation.isPending || (selectedUser?.role === "teacher" && (!editUserForm.schoolId || !editUserForm.assignedClassId))}
                data-testid="button-save-edit"
              >
                {editUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user account? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedUserForDeletion && (
              <div className="py-4">
                <p className="text-sm text-gray-600">
                  <strong>Name:</strong> {formatStudentName(selectedUserForDeletion)}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {selectedUserForDeletion.email}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Role:</strong> {selectedUserForDeletion.role}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline"
                onClick={() => setIsDeleteUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedUserForDeletion) {
                    deleteUserMutation.mutate(selectedUserForDeletion.id);
                  }
                }}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
