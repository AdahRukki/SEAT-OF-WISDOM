import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, User, ArrowLeft, Home } from "lucide-react";
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

export default function NewsDetailPage() {
  const params = useParams();
  const newsId = params.id;

  const { data: allNews = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  const newsItem = allNews.find((item) => item.id === newsId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    Seat of Wisdom Academy
                  </span>
                </div>
              </Link>
              <Link href="/news">
                <Button variant="outline" size="sm" data-testid="button-back-to-news">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to News
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!newsItem) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    Seat of Wisdom Academy
                  </span>
                </div>
              </Link>
              <Link href="/news">
                <Button variant="outline" size="sm" data-testid="button-back-to-news">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to News
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Article not found</p>
              <Link href="/news">
                <Button data-testid="button-view-all-news">
                  View All News
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const articleDescription = newsItem.content.substring(0, 160).trim() + (newsItem.content.length > 160 ? '...' : '');
  const authorName = `${newsItem.author.firstName} ${newsItem.author.lastName}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <SEO
        title={newsItem.title}
        description={articleDescription}
        keywords={`${newsItem.tag || 'academy news'}, seat of wisdom academy, school news, educational updates`}
        ogType="article"
        ogImage={newsItem.imageUrl || academyLogo}
        ogUrl={window.location.href}
        articlePublishedTime={newsItem.publishedAt}
        articleAuthor={authorName}
        articleTags={newsItem.tag ? [newsItem.tag] : []}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": newsItem.title,
          "description": articleDescription,
          "image": newsItem.imageUrl || academyLogo,
          "datePublished": newsItem.publishedAt,
          "author": {
            "@type": "Person",
            "name": authorName
          },
          "publisher": {
            "@type": "EducationalOrganization",
            "name": "Seat of Wisdom Academy",
            "logo": {
              "@type": "ImageObject",
              "url": academyLogo
            }
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": window.location.href
          }
        }}
      />
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity">
                <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  Seat of Wisdom Academy
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-home">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
              <Link href="/news">
                <Button variant="outline" size="sm" data-testid="button-back-to-news">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to News
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Article Header */}
        <div className="mb-8">
          {newsItem.tag && (
            <Badge variant="secondary" className="mb-4" data-testid="badge-article-tag">
              {newsItem.tag}
            </Badge>
          )}
          <h1 
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight" 
            data-testid="text-article-title"
          >
            {newsItem.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2" data-testid="text-article-author">
              <User className="w-4 h-4" />
              <span>
                {newsItem.author.firstName} {newsItem.author.lastName}
              </span>
            </div>
            <div className="flex items-center gap-2" data-testid="text-article-date">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(newsItem.publishedAt), "MMMM dd, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Featured Image */}
        {newsItem.imageUrl && (
          <div className="mb-8 rounded-lg overflow-hidden shadow-lg">
            <img
              src={newsItem.imageUrl}
              alt={newsItem.title}
              className="w-full h-auto object-cover max-h-[600px]"
              data-testid="img-article-featured"
            />
          </div>
        )}

        {/* Article Body */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="py-8 px-6 md:px-12">
            <div 
              className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400"
              data-testid="text-article-content"
            >
              {newsItem.content.split('\n').map((paragraph, index) => (
                paragraph.trim() && <p key={index}>{paragraph}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Back to News Button */}
        <div className="mt-12 text-center">
          <Link href="/news">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-all-articles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              View All Articles
            </Button>
          </Link>
        </div>
      </article>
    </div>
  );
}
