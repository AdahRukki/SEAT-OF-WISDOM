import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  tag: string | null;
  publishedAt: string;
  author: {
    firstName: string;
    lastName: string;
  };
}

export function NewsManagement() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data: newsItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  const createNewsMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; imageUrl?: string; tag?: string }) => {
      return await apiRequest("/api/news", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "News created successfully" });
      setTitle("");
      setContent("");
      setTag("");
      setImageUrl("");
    },
    onError: () => {
      toast({ title: "Failed to create news", variant: "destructive" });
    },
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (newsId: string) => {
      return await apiRequest(`/api/news/${newsId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "News deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete news", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    createNewsMutation.mutate({
      title,
      content,
      imageUrl: imageUrl || undefined,
      tag: tag || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create News Article
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="News article title"
                data-testid="input-news-title"
              />
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your news article content here..."
                rows={6}
                data-testid="textarea-news-content"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tag">Tag</Label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger data-testid="select-news-tag">
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Events">Events</SelectItem>
                    <SelectItem value="Announcements">Announcements</SelectItem>
                    <SelectItem value="Academic">Academic</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Awards">Awards</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Upload Image (optional)</Label>
                <ObjectUploader
                  onGetUploadParameters={async () => {
                    const response = await apiRequest("/api/upload/news-image", { method: "POST" });
                    return {
                      method: "PUT" as const,
                      url: response.uploadUrl,
                    };
                  }}
                  onComplete={(result) => {
                    if (result.successful && result.successful.length > 0) {
                      const uploadedFile = result.successful[0];
                      if (uploadedFile.uploadURL) {
                        const publicUrl = uploadedFile.uploadURL.split('?')[0];
                        setImageUrl(publicUrl);
                        toast({ title: "Image uploaded successfully" });
                      }
                    }
                  }}
                >
                  Upload News Image
                </ObjectUploader>
                {imageUrl && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Image uploaded successfully
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={createNewsMutation.isPending}
              className="w-full"
              data-testid="button-create-news"
            >
              {createNewsMutation.isPending ? "Creating..." : "Create News Article"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published News Articles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : newsItems.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No news articles yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-news-${item.id}`}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.tag || "-"}</TableCell>
                    <TableCell>{`${item.author.firstName} ${item.author.lastName}`}</TableCell>
                    <TableCell>{format(new Date(item.publishedAt), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteNewsMutation.mutate(item.id)}
                        disabled={deleteNewsMutation.isPending}
                        data-testid={`button-delete-news-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
