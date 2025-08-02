import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, PlusCircle, Eye } from "lucide-react";
import { Student } from "@shared/schema";
import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface StudentRowProps {
  student: Student;
}

export function StudentRow({ student }: StudentRowProps) {
  const [showAddScore, setShowAddScore] = useState(false);
  const [newScore, setNewScore] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAverageScore = () => {
    if (student.scores.length === 0) return 0;
    return student.scores.reduce((sum, score) => sum + score, 0) / student.scores.length;
  };

  const getLatestScore = () => {
    if (student.scores.length === 0) return "N/A";
    return student.scores[student.scores.length - 1];
  };

  const getStatus = () => {
    const avg = getAverageScore();
    if (avg >= 90) return { text: "Excellent", color: "bg-green-100 text-green-800" };
    if (avg >= 80) return { text: "Good", color: "bg-blue-100 text-blue-800" };
    if (avg >= 70) return { text: "Fair", color: "bg-yellow-100 text-yellow-800" };
    return { text: "Needs Help", color: "bg-red-100 text-red-800" };
  };

  const handleAddScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScore || isNaN(parseInt(newScore))) return;

    const score = parseInt(newScore);
    if (score < 0 || score > 100) {
      toast({
        title: "Error",
        description: "Score must be between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const studentRef = doc(db, "students", student.id);
      await updateDoc(studentRef, {
        scores: arrayUnion(score),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Score added successfully!",
      });

      setNewScore("");
      setShowAddScore(false);
    } catch (error) {
      console.error("Error adding score:", error);
      toast({
        title: "Error",
        description: "Failed to add score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const status = getStatus();

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {getInitials(student.name)}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">{student.name}</div>
              <div className="text-sm text-gray-500">{student.email}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{student.class}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{getLatestScore()}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{getAverageScore().toFixed(1)}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
            {status.text}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700 mr-2"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600 hover:text-green-700 mr-2"
            onClick={() => setShowAddScore(true)}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-800"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </td>
      </tr>

      <Dialog open={showAddScore} onOpenChange={setShowAddScore}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Score for {student.name}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddScore} className="space-y-4">
            <div>
              <label htmlFor="score" className="block text-sm font-medium text-gray-700 mb-1">
                Score (0-100)
              </label>
              <Input
                type="number"
                id="score"
                min="0"
                max="100"
                placeholder="Enter score"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                required
              />
            </div>
            
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddScore(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Add Score"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
