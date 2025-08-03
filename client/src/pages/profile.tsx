import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Calendar, Shield, Building, Edit, Save, X } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { School } from "@shared/schema";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Edit profile state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || ''
  });

  // Get school name for sub-admin users
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['/api/admin/schools'],
    enabled: user?.role === 'sub-admin' && !!(user as any).schoolId
  });

  const userSchool = schools.find(school => school.id === (user as any)?.schoolId);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { firstName: string; lastName: string; email: string }) => {
      return apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: profileData
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    updateProfileMutation.mutate(editForm);
  };

  const handleEditCancel = () => {
    setEditForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    });
    setIsEditDialogOpen(false);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const handleGoBack = () => {
    if (user.role === 'admin' || user.role === 'sub-admin') {
      setLocation('/');
    } else {
      setLocation('/student');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'sub-admin': return 'secondary';
      case 'student': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Main Administrator';
      case 'sub-admin': return 'School Administrator';
      case 'student': return 'Student';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl">{user.firstName} {user.lastName}</CardTitle>
            <CardDescription className="flex items-center justify-center gap-2">
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {getRoleDisplayName(user.role)}
              </Badge>
            </CardDescription>
            
            {/* Edit Profile Button */}
            <div className="mt-4">
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                      Update your personal information below.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleEditCancel}
                        disabled={updateProfileMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Email Address</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Account Role</p>
                    <p className="font-medium">{getRoleDisplayName(user.role)}</p>
                  </div>
                </div>

                {/* Show school for sub-admin */}
                {user.role === 'sub-admin' && userSchool && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Assigned School</p>
                      <p className="font-medium">{userSchool.name}</p>
                    </div>
                  </div>
                )}

                {/* Show student ID for students */}
                {user.role === 'student' && (user as any).studentId && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Student ID</p>
                      <p className="font-medium">{(user as any).studentId}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Account Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Account Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Account Created</p>
                    <p className="font-medium">
                      {(user as any).createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium">
                      {(user as any).updatedAt ? new Date((user as any).updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Permissions & Access
              </h3>
              <div className="space-y-2">
                {user.role === 'admin' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <span className="text-sm">Manage all schools</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <span className="text-sm">User management</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <span className="text-sm">System configuration</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">✓ Enabled</Badge>
                    </div>
                  </>
                )}
                
                {user.role === 'sub-admin' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-sm">Manage assigned school</span>
                      <Badge variant="outline" className="text-blue-600 border-blue-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-sm">Student management</span>
                      <Badge variant="outline" className="text-blue-600 border-blue-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm">System-wide access</span>
                      <Badge variant="outline" className="text-gray-500 border-gray-400">✗ Restricted</Badge>
                    </div>
                  </>
                )}

                {user.role === 'student' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <span className="text-sm">View academic records</span>
                      <Badge variant="outline" className="text-purple-600 border-purple-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <span className="text-sm">Access report cards</span>
                      <Badge variant="outline" className="text-purple-600 border-purple-600">✓ Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm">Administrative functions</span>
                      <Badge variant="outline" className="text-gray-500 border-gray-400">✗ Restricted</Badge>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}