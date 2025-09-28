import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
        method: 'PUT',
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
      default: return 'bg-gray-600';
    }
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || 'Unknown School';
  };

  const openEditUser = (userData: User) => {
    setSelectedUser(userData);
    setEditUserForm({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      schoolId: userData.schoolId || "",
      isActive: userData.isActive ?? true,
      password: "",
      confirmPassword: "",
      changePassword: false
    });
    setIsEditUserDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Left side - Logo and Brand */}
              <div className="flex items-center space-x-4">
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
                  {users.length} Admin Accounts
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
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
                    <p className="text-base">{selectedUser.firstName} {selectedUser.lastName}</p>
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
                    value={editUserForm.schoolId}
                    onValueChange={(value) => setEditUserForm(prev => ({ ...prev, schoolId: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-school">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Schools (Admin)</SelectItem>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                    isActive: editUserForm.isActive,
                    ...(editUserForm.changePassword && editUserForm.password && {
                      password: editUserForm.password
                    })
                  };
                  
                  editUserMutation.mutate(updateData);
                }}
                disabled={editUserMutation.isPending}
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
                  <strong>Name:</strong> {selectedUserForDeletion.firstName} {selectedUserForDeletion.lastName}
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