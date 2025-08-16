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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  Users,
  UserPlus,
  Settings,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Upload,
  RefreshCw,
  ArrowLeft,
  Image,
  User as UserIcon,
  LogOut,
  LayoutDashboard
} from "lucide-react";
import logoImage from "@assets/4oWHptM_1754171230437.gif";
import type { User, School as SchoolType } from "@shared/schema";

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for dialogs
  const [isCreateSubAdminDialogOpen, setIsCreateSubAdminDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<User | null>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  
  // Form states for sub-admin creation
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  
  // School editing state
  const [editingSchool, setEditingSchool] = useState<SchoolType | null>(null);
  const [schoolFormData, setSchoolFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: ""
  });
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  
  // Edit user form states
  const [editUserForm, setEditUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    schoolId: "",
    isActive: true
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
      role: string;
    }) => {
      return apiRequest('/api/admin/users', {
        method: 'POST',
        body: {...data, role: 'sub-admin'}
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsCreateSubAdminDialogOpen(false);
      resetSubAdminForm();
      toast({
        title: "Success",
        description: "Sub-admin created successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create sub-admin",
        variant: "destructive"
      });
    }
  });

  // School editing mutation
  const editSchoolMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; address: string; phone: string; email: string }) => {
      return apiRequest(`/api/admin/schools/${data.id}`, {
        method: 'PUT',
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schools'] });
      setEditingSchool(null);
      toast({
        title: "Success",
        description: "School information updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to update school information",
        variant: "destructive"
      });
    }
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      schoolId?: string;
      isActive: boolean;
    }) => {
      return apiRequest(`/api/admin/users/${data.id}`, {
        method: 'PUT',
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users?adminOnly=true'] });
      setIsDeleteUserDialogOpen(false);
      setSelectedUserForDeletion(null);
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  });

  const resetSubAdminForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setSelectedSchoolId("");
  };



  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'sub-admin': return 'bg-blue-500';
      case 'student': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getSchoolName = (schoolId: string) => {
    return schools.find(s => s.id === schoolId)?.name || 'Unknown School';
  };

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only main administrators can access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <div className="flex items-center space-x-2 min-w-0">
                <img 
                  src={logoImage} 
                  alt="Seat of Wisdom Academy Logo" 
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-md flex-shrink-0" 
                />
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    User Management
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                    Manage system users and administrators
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* Back to Dashboard Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/"
                    className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Return to the main admin dashboard</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Profile Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/profile"
                    className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Profile</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View and edit your profile</p>
                </TooltipContent>
              </Tooltip>
              
              <div className="flex items-center space-x-1 sm:space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <UserIcon className="h-4 w-4" />
                <span className="hidden md:inline">{user?.firstName} {user?.lastName}</span>
                <span className="md:hidden text-xs">{user?.firstName}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                className="px-2 sm:px-4"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage admin accounts, create sub-admins, and configure school settings
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="text-sm">All Users</TabsTrigger>
            <TabsTrigger value="schools" className="text-sm">School Settings</TabsTrigger>
          </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span className="text-lg font-semibold">
                {users.length} Admin Accounts
              </span>
            </div>
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
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="school">Assign to School</Label>
                    <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select school" />
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
                  <Button variant="outline" onClick={() => setIsCreateSubAdminDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      createSubAdminMutation.mutate({
                        firstName,
                        lastName,
                        email,
                        password,
                        schoolId: selectedSchoolId,
                        role: 'sub-admin'
                      });
                    }}
                    disabled={createSubAdminMutation.isPending || !firstName || !lastName || !email || !password || !selectedSchoolId}
                  >
                    {createSubAdminMutation.isPending ? "Creating..." : "Create Sub-Admin"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Accounts Overview</CardTitle>
              <CardDescription>
                View and manage admin and sub-admin accounts only
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                              <p>View user profile details</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditUserForm({
                                    firstName: user.firstName || "",
                                    lastName: user.lastName || "",
                                    email: user.email || "",
                                    schoolId: user.schoolId || "",
                                    isActive: user.isActive ?? true
                                  });
                                  setIsEditUserDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit user details and permissions</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {/* Switch to Sub-Admin Dashboard - Only show for sub-admin users */}
                          {user.role === 'sub-admin' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const schoolName = user.schoolId ? getSchoolName(user.schoolId) : 'Unknown School';
                                    toast({
                                      title: "Redirecting to Dashboard",
                                      description: `Opening ${user.firstName}'s dashboard for ${schoolName}...`
                                    });
                                    // Navigate to admin dashboard - it will show sub-admin view for their school
                                    window.location.href = '/';
                                  }}
                                  className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                                >
                                  <LayoutDashboard className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Go to main dashboard to view {user.firstName}'s school</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
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
        </TabsContent>

        <TabsContent value="schools" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {schools.map((school) => (
              <Card key={school.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{school.name}</CardTitle>
                      <CardDescription>{school.address}</CardDescription>
                    </div>
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {school.logoUrl ? (
                        <img
                          src={school.logoUrl}
                          alt={`${school.name} logo`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Image className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {school.phone && <p>Phone: {school.phone}</p>}
                    {school.email && <p>Email: {school.email}</p>}
                  </div>
                  <div className="mt-4 space-y-2">
                    <Dialog open={editingSchool?.id === school.id} onOpenChange={(open) => {
                      if (open) {
                        setEditingSchool(school);
                        setSchoolFormData({
                          name: school.name || "",
                          address: school.address || "",
                          phone: school.phone || "",
                          email: school.email || ""
                        });
                      } else {
                        setEditingSchool(null);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit School Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit School Details</DialogTitle>
                          <DialogDescription>
                            Update information for {school.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div>
                            <Label htmlFor="school-name">School Name</Label>
                            <Input
                              id="school-name"
                              value={schoolFormData.name}
                              onChange={(e) => setSchoolFormData({...schoolFormData, name: e.target.value})}
                              placeholder="Enter school name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="school-address">Address</Label>
                            <Input
                              id="school-address"
                              value={schoolFormData.address}
                              onChange={(e) => setSchoolFormData({...schoolFormData, address: e.target.value})}
                              placeholder="Enter school address"
                            />
                          </div>
                          <div>
                            <Label htmlFor="school-phone">Phone</Label>
                            <Input
                              id="school-phone"
                              value={schoolFormData.phone}
                              onChange={(e) => setSchoolFormData({...schoolFormData, phone: e.target.value})}
                              placeholder="Enter phone number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="school-email">Email</Label>
                            <Input
                              id="school-email"
                              type="email"
                              value={schoolFormData.email}
                              onChange={(e) => setSchoolFormData({...schoolFormData, email: e.target.value})}
                              placeholder="Enter email address"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline"
                            onClick={() => setEditingSchool(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              if (editingSchool) {
                                editSchoolMutation.mutate({
                                  id: editingSchool.id,
                                  name: schoolFormData.name,
                                  address: schoolFormData.address,
                                  phone: schoolFormData.phone,
                                  email: schoolFormData.email
                                });
                              }
                            }}
                            disabled={editSchoolMutation.isPending}
                          >
                            {editSchoolMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="text-center py-2">
                      <p className="text-xs text-gray-500">
                        Logo managed centrally in Admin Dashboard
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        </Tabs>

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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    value={editUserForm.firstName}
                    onChange={(e) => setEditUserForm({...editUserForm, firstName: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    value={editUserForm.lastName}
                    onChange={(e) => setEditUserForm({...editUserForm, lastName: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({...editUserForm, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              {selectedUser?.role === 'sub-admin' && (
                <div>
                  <Label htmlFor="editSchool">Assigned School</Label>
                  <Select 
                    value={editUserForm.schoolId} 
                    onValueChange={(value) => setEditUserForm({...editUserForm, schoolId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select school" />
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
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editUserForm.isActive}
                  onChange={(e) => setEditUserForm({...editUserForm, isActive: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="editIsActive">Active User</Label>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser) {
                    editUserMutation.mutate({
                      id: selectedUser.id,
                      firstName: editUserForm.firstName,
                      lastName: editUserForm.lastName,
                      email: editUserForm.email,
                      schoolId: editUserForm.schoolId || undefined,
                      isActive: editUserForm.isActive
                    });
                  }
                }}
                disabled={editUserMutation.isPending || !editUserForm.firstName || !editUserForm.lastName || !editUserForm.email}
              >
                {editUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedUserForDeletion && (
              <div className="py-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <UserIcon className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">
                      {selectedUserForDeletion.firstName} {selectedUserForDeletion.lastName}
                    </span>
                  </div>
                  <p className="text-sm text-red-700">{selectedUserForDeletion.email}</p>
                  <Badge className={`${getRoleBadgeColor(selectedUserForDeletion.role)} text-white mt-2`}>
                    {selectedUserForDeletion.role}
                  </Badge>
                </div>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteUserDialogOpen(false);
                  setSelectedUserForDeletion(null);
                }}
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
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </TooltipProvider>
  );
}