import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalStudents } from "@/hooks/use-local-students";
import { insertStudentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddStudentModal({ isOpen, onClose }: AddStudentModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    class: "",
    initialScore: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { addStudent } = useLocalStudents();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const scores = formData.initialScore ? [parseInt(formData.initialScore)] : [];
      
      const validatedData = insertStudentSchema.parse({
        name: formData.name,
        email: formData.email,
        class: formData.class,
        scores,
      });

      await addStudent(validatedData);

      toast({
        title: "Success",
        description: "Student added successfully! (Saved locally)",
      });

      setFormData({ name: "", email: "", class: "", initialScore: "" });
      onClose();
    } catch (error) {
      console.error("Error adding student:", error);
      toast({
        title: "Error",
        description: "Failed to add student. Please check your input and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", email: "", class: "", initialScore: "" });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-1">
              Student Name
            </Label>
            <Input
              type="text"
              id="studentName"
              placeholder="Enter student name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </Label>
            <Input
              type="email"
              id="studentEmail"
              placeholder="student@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="studentClass" className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </Label>
            <Select value={formData.class} onValueChange={(value) => setFormData({ ...formData, class: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Math 101">Math 101</SelectItem>
                <SelectItem value="Science 201">Science 201</SelectItem>
                <SelectItem value="English 102">English 102</SelectItem>
                <SelectItem value="History 103">History 103</SelectItem>
                <SelectItem value="Physics 301">Physics 301</SelectItem>
                <SelectItem value="Chemistry 302">Chemistry 302</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="initialScore" className="block text-sm font-medium text-gray-700 mb-1">
              Initial Score (Optional)
            </Label>
            <Input
              type="number"
              id="initialScore"
              placeholder="0-100"
              min="0"
              max="100"
              value={formData.initialScore}
              onChange={(e) => setFormData({ ...formData, initialScore: e.target.value })}
            />
          </div>
          
          <div className="flex space-x-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Student"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
