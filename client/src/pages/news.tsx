import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowRight, Home } from "lucide-react";
import academyLogo from "@assets/academy-logo.png";
import { SEO } from "@/components/SEO";

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

export default function NewsPage() {
  const { data: newsItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">Academy News</h1>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const latestNewsImage = newsItems.length > 0 && newsItems[0].imageUrl ? newsItems[0].imageUrl : academyLogo;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <SEO
        title="Academy News & Updates"
        description="Stay informed with the latest news, announcements, achievements, and updates from Seat of Wisdom Academy. Read about our students' accomplishments, school events, and educational programs."
        keywords="academy news, school updates, educational announcements, student achievements, school events, Seat of Wisdom Academy news"
        ogType="website"
        ogImage={latestNewsImage}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Seat of Wisdom Academy News",
          "description": "Official news and updates from Seat of Wisdom Academy",
          "url": window.location.href,
          "publisher": {
            "@type": "EducationalOrganization",
            "name": "Seat of Wisdom Academy",
            "logo": {
              "@type": "ImageObject",
              "url": academyLogo
            }
          },
          "blogPost": newsItems.slice(0, 5).map(item => ({
            "@type": "BlogPosting",
            "headline": item.title,
            "datePublished": item.publishedAt,
            "author": {
              "@type": "Person",
              "name": `${item.author.firstName} ${item.author.lastName}`
            },
            "url": `${window.location.origin}/news/${item.id}`
          }))
        }}
      />
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
                <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  Seat of Wisdom Academy
                </span>
              </div>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" data-testid="button-home">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-4" data-testid="text-news-page-title">
            Academy News & Updates
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Stay informed with the latest news, announcements, and updates from Seat of Wisdom Academy
          </p>
        </div>

        {newsItems.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No news articles available at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newsItems.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                data-testid={`card-news-${item.id}`}
              >
                {item.imageUrl && (
                  <div className="h-48 overflow-hidden bg-gray-100 dark:bg-gray-700">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      data-testid={`img-news-${item.id}`}
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    {item.tag && (
                      <Badge variant="secondary" data-testid={`badge-tag-${item.id}`}>
                        {item.tag}
                      </Badge>
                    )}
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(item.publishedAt), "MMM dd, yyyy")}
                    </div>
                  </div>
                  <CardTitle className="text-xl" data-testid={`text-news-title-${item.id}`}>
                    {item.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span data-testid={`text-author-${item.id}`}>
                      {item.author.firstName} {item.author.lastName}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-4 flex-1" data-testid={`text-content-${item.id}`}>
                    {item.content}
                  </p>
                  <Link href={`/news/${item.id}`}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid={`button-read-article-${item.id}`}>
                      Read Full Article
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
