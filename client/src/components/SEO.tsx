import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  ogUrl?: string;
  articlePublishedTime?: string;
  articleAuthor?: string;
  articleTags?: string[];
  structuredData?: object;
}

export function SEO({
  title,
  description,
  keywords,
  ogType = 'website',
  ogImage,
  ogUrl,
  articlePublishedTime,
  articleAuthor,
  articleTags,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    const currentUrl = window.location.href;
    const siteName = 'Seat of Wisdom Academy';
    const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
    
    document.title = fullTitle;
    
    const createdElements: HTMLElement[] = [];
    
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        element.setAttribute('data-seo-managed', 'true');
        document.head.appendChild(element);
        createdElements.push(element);
      }
      
      element.setAttribute('content', content);
    };

    updateMetaTag('description', description);
    if (keywords) {
      updateMetaTag('keywords', keywords);
    }

    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:url', ogUrl || currentUrl, true);
    updateMetaTag('og:site_name', siteName, true);
    
    if (ogImage) {
      updateMetaTag('og:image', ogImage, true);
      updateMetaTag('og:image:alt', title, true);
    }

    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    if (ogImage) {
      updateMetaTag('twitter:image', ogImage);
    }

    if (ogType === 'article') {
      if (articlePublishedTime) {
        updateMetaTag('article:published_time', articlePublishedTime, true);
      }
      if (articleAuthor) {
        updateMetaTag('article:author', articleAuthor, true);
      }
      if (articleTags && articleTags.length > 0) {
        const existingTagElements = document.querySelectorAll('meta[property="article:tag"]');
        existingTagElements.forEach(el => el.remove());
        
        articleTags.forEach((tag) => {
          const tagElement = document.createElement('meta');
          tagElement.setAttribute('property', 'article:tag');
          tagElement.setAttribute('content', tag);
          tagElement.setAttribute('data-seo-managed', 'true');
          document.head.appendChild(tagElement);
          createdElements.push(tagElement);
        });
      }
    }

    let scriptElement: HTMLScriptElement | null = null;
    if (structuredData) {
      scriptElement = document.querySelector('script[type="application/ld+json"][data-seo-managed="true"]') as HTMLScriptElement;
      
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.setAttribute('type', 'application/ld+json');
        scriptElement.setAttribute('data-seo-managed', 'true');
        document.head.appendChild(scriptElement);
      }
      
      scriptElement.textContent = JSON.stringify(structuredData);
    }

    return () => {
      const articleSpecificTags = [
        'meta[property="article:published_time"]',
        'meta[property="article:author"]',
        'meta[property="article:tag"]',
        'script[type="application/ld+json"][data-seo-managed="true"]'
      ];
      
      articleSpecificTags.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
    };
  }, [title, description, keywords, ogType, ogImage, ogUrl, articlePublishedTime, articleAuthor, articleTags, structuredData]);

  return null;
}
