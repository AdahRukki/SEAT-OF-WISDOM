import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bell, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NotificationsManagement() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  const sendNotificationMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Notification sent successfully",
        description: `Sent to ${data.count} students`
      });
      setMessage("");
    },
    onError: () => {
      toast({ 
        title: "Failed to send notification", 
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({ 
        title: "Message is required", 
        variant: "destructive"
      });
      return;
    }
    sendNotificationMutation.mutate(message);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Send Notification to All Students
          </CardTitle>
          <CardDescription>
            Send an instant message to all students in the system. They will see it in their dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="notification-message">Notification Message</Label>
              <Textarea
                id="notification-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your notification message here (e.g., 'School closes early tomorrow at 2 PM')"
                rows={6}
                className="resize-none"
                data-testid="textarea-notification-message"
              />
              <p className="text-sm text-gray-500 mt-1">
                {message.length} characters
              </p>
            </div>

            <Button
              type="submit"
              disabled={sendNotificationMutation.isPending || !message.trim()}
              className="w-full"
              data-testid="button-send-notification"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendNotificationMutation.isPending ? "Sending..." : "Send Notification to All Students"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Notifications are sent instantly to all students</li>
              <li>Students see a notification bell icon with unread count</li>
              <li>Notifications appear in their inbox on the student dashboard</li>
              <li>Students can mark notifications as read</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
