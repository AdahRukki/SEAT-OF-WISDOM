import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GraduationCap, Users, BookOpen, Trophy, MapPin, Phone, Mail, ChevronRight, Baby, School, GraduationCap as GraduationIcon, Grid3X3, ExternalLink, Activity, Dumbbell, Music, Palette, Building, Microscope, Calculator, Award, Menu } from "lucide-react";
import { SEO } from "@/components/SEO";
import schoolBuilding1 from "@assets/stock_images/modern_school_buildi_77850497.jpg";
import schoolBuilding2 from "@assets/stock_images/modern_school_buildi_a486f75c.jpg";
import classroomImage1 from "@assets/stock_images/children_in_classroo_646d36b7.jpg";
import classroomImage2 from "@assets/stock_images/children_in_classroo_aaa62f0f.jpg";
import classroomImage3 from "@assets/stock_images/children_in_classroo_d7f501cb.jpg";
import classroomImage4 from "@assets/stock_images/children_in_classroo_7e1fd1a4.jpg";
import classroomImage5 from "@assets/stock_images/children_in_classroo_ebca6607.jpg";
import classroomImage6 from "@assets/stock_images/children_in_classroo_cd155654.jpg";
import sportsImage1 from "@assets/stock_images/students_playing_spo_5fbb199e.jpg";
import sportsImage2 from "@assets/stock_images/students_playing_spo_b955460a.jpg";
import sportsImage3 from "@assets/stock_images/students_playing_spo_dc5ee1e8.jpg";
import sportsImage4 from "@assets/stock_images/students_playing_spo_89a50a23.jpg";
import libraryImage1 from "@assets/stock_images/school_library_labor_57146f98.jpg";
import libraryImage2 from "@assets/stock_images/school_library_labor_4709a4fa.jpg";
import labImage1 from "@assets/stock_images/school_library_labor_50c8c89f.jpg";
import labImage2 from "@assets/stock_images/school_library_labor_35422e2d.jpg";
import academyLogo from "@assets/academy-logo.png";

import sch_2_pic from "@assets/sch 2 pic.jpg";

import image_2 from "@assets/image_2.jpg";

import WhatsApp_Image_2025_10_24_at_03_44_15_e8340d72 from "@assets/WhatsApp Image 2025-10-24 at 03.44.15_e8340d72.jpg";
import libraryCardImage from "@assets/library.jpeg";

import images__4_ from "@assets/images (4).jpeg";

import ChatGPT_Image_Nov_13__2025__08_01_22_PM from "@assets/ChatGPT Image Nov 13, 2025, 08_01_22 PM.png";

import ChatGPT_Image_Nov_13__2025__08_01_18_PM from "@assets/ChatGPT Image Nov 13, 2025, 08_01_18 PM.png";

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

function NewsExcerptSection() {
  const { data: newsItems = [] } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  const latestNews = newsItems.slice(0, 6);

  if (latestNews.length === 0) return null;

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-news-section-title">
            Latest News & Updates
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-news-section-description">
            Stay informed about academy events, achievements, and announcements
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestNews.map((item) => (
            <Link key={item.id} href={`/news/${item.id}`}>
              <div className="relative group overflow-hidden rounded-lg shadow-lg cursor-pointer h-80" data-testid={`card-news-preview-${item.id}`}>
                <img 
                  src={item.imageUrl || classroomImage3}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300"></div>
                
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    {item.tag && (
                      <Badge className="mb-3 bg-blue-600 text-white border-0">
                        {item.tag}
                      </Badge>
                    )}
                    <h3 className="text-xl font-bold mb-2 line-clamp-2" data-testid={`text-news-preview-title-${item.id}`}>
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-200 mb-2">
                      {format(new Date(item.publishedAt), "MMM dd, yyyy")}
                    </p>
                    <p className="text-sm text-gray-300 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {item.content}
                    </p>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg">
                    Read Article
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/news">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-view-all-news">
              View All News
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function SchoolHomepage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="Seat of Wisdom Academy - Premier Multi-Branch Education"
        description="Seat of Wisdom Academy is a leading educational institution offering comprehensive learning across four branches. Excellence in academics, character development, and holistic education for students from nursery to senior secondary levels."
        keywords="seat of wisdom academy, private school, multi-branch school, quality education, academic excellence, nursery school, primary school, secondary school, holistic education, character development"
        ogType="website"
        ogImage={schoolBuilding1}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "name": "Seat of Wisdom Academy",
          "description": "Premier multi-branch educational institution offering comprehensive learning from nursery to senior secondary levels",
          "url": window.location.origin,
          "logo": academyLogo,
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "Nigeria"
          },
          "sameAs": []
        }}
      />
      {/* Navigation */}
      <nav className="border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-8">
                <Link href="/about" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</Link>
                <Link href="/programs" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Programs</Link>
                <Link href="/admissions" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Admissions</Link>
                <Link href="/news" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">News</Link>
                <Link href="/contact" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</Link>
                <Link href="/portal">
                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-portal-login">
                    Student Portal
                  </Button>
                </Link>
              </div>
              
              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center space-x-2">
                      <img src={academyLogo} alt="Academy Logo" className="h-6 w-6 object-contain" />
                      <span>Seat of Wisdom Academy</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col space-y-6 mt-8">
                    {/* Prominent Student Portal Button */}
                    <Link href="/portal" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xl font-bold h-16 shadow-lg border border-blue-500" data-testid="button-mobile-portal">
                        🎓 Student Portal Login
                      </Button>
                    </Link>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                    
                    {/* Other Navigation Links */}
                    <div className="flex flex-col space-y-2">
                      <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-about">
                          About
                        </Button>
                      </Link>
                      <Link href="/programs" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-programs">
                          Programs
                        </Button>
                      </Link>
                      <Link href="/admissions" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-admissions">
                          Admissions
                        </Button>
                      </Link>
                      <Link href="/news" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-news">
                          News
                        </Button>
                      </Link>
                      <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-contact">
                          Contact
                        </Button>
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-motto">
                Excellence in Education
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-hero-title">
                Nurturing Minds,
                <span className="text-blue-600 dark:text-blue-400"> Building Futures</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed" data-testid="text-hero-description">
                At Seat of Wisdom Academy, we provide quality education across four campuses, 
                fostering academic excellence and character development in every student.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/admissions">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-apply-now">
                    Apply Now
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/portal">
                  <Button size="lg" variant="outline" data-testid="button-student-portal">
                    Student Portal
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                <img 
                  src={sch_2_pic} 
                  alt="Seat of Wisdom Academy campus" 
                  className="w-full h-64 object-cover"
                  data-testid="img-school-hero"
                />
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-stat-branches">4</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Branches</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-stat-years">15+</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Years</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-features-title">
              Why Choose Seat of Wisdom Academy?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-features-description">
              We combine academic excellence with character development to prepare students for success in life.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-feature-1">
              <CardHeader>
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Quality Education</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive curriculum designed to meet international standards and local needs.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-feature-2">
              <CardHeader>
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Expert Faculty</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Experienced and qualified teachers dedicated to student success and development.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-feature-3">
              <CardHeader>
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Trophy className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Excellence Awards</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Consistent recognition for academic achievements and extracurricular activities.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-feature-4">
              <CardHeader>
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <MapPin className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle>Multiple Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Four strategically located branches to serve communities across the region.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Education Programs Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-programs-title">
              Our Education Programs
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-programs-description">
              Comprehensive education from early childhood through secondary school
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-nursery">
              <div className="relative h-64 md:h-48">
                <img 
                  src={ChatGPT_Image_Nov_13__2025__08_01_22_PM} 
                  alt="Nursery students learning" 
                  className="w-full h-full object-cover object-center md:object-top"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-blue-600 text-white">Nursery</Badge>
                </div>
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Baby className="h-6 w-6 text-blue-600 mr-2" />
                  <CardTitle>Nursery Education</CardTitle>
                </div>
                <CardDescription>Play Class - KG3</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Early childhood development through play-based learning, foundational skills, 
                  and social interaction in a nurturing environment.
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <li>• Play Class</li>
                  <li>• Kindergarten 1-3</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-primary">
              <div className="relative h-64 md:h-48">
                <img 
                  src={ChatGPT_Image_Nov_13__2025__08_01_18_PM} 
                  alt="Primary students in classroom" 
                  className="w-full h-full object-cover object-center md:object-top"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-green-600 text-white">Primary</Badge>
                </div>
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <School className="h-6 w-6 text-green-600 mr-2" />
                  <CardTitle>Primary Education</CardTitle>
                </div>
                <CardDescription>Basic 1 - Basic 5</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Building strong foundations in literacy, numeracy, and life skills 
                  through engaging and interactive learning methods.
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <li>• Basic 1-5</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-secondary">
              <div className="relative h-48">
                <img 
                  src={image_2} 
                  alt="Secondary students studying" 
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-purple-600 text-white">Secondary</Badge>
                </div>
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <GraduationIcon className="h-6 w-6 text-purple-600 mr-2" />
                  <CardTitle>Secondary Education</CardTitle>
                </div>
                <CardDescription>JSS1-3, SS1-3</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Advanced academic preparation with specialized subjects, 
                  critical thinking development, and university readiness.
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <li>• Junior Secondary (JSS 1-3)</li>
                  <li>• Senior Secondary (SS 1-3)</li>
                  <li>• Science & Arts Combinations</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Visit Our School Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-locations-title">
              Visit Our School
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-locations-description">
              Four convenient locations across Asaba, Delta State
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-location-1">
              <CardHeader>
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                  <CardTitle className="text-lg">BONSAAC</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                  Bonsaac, Asaba
                </p>
                <a 
                  href="https://maps.google.com/?q=Bonsaac,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                  data-testid="link-location-1"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-location-2">
              <CardHeader>
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-green-600 mr-2" />
                  <CardTitle className="text-lg">IKPOTO POWERLINE</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                  Ikpoto Powerline, Asaba
                </p>
                <a 
                  href="https://maps.google.com/?q=Ikpoto+Powerline,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                  data-testid="link-location-2"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-location-3">
              <CardHeader>
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-purple-600 mr-2" />
                  <CardTitle className="text-lg">AKWUOFOR</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                  Akwuofor along Amusement Park, Koka
                </p>
                <a 
                  href="https://maps.google.com/?q=Akwuofor+Amusement+Park+Koka,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                  data-testid="link-location-3"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-location-4">
              <CardHeader>
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-orange-600 mr-2" />
                  <CardTitle className="text-lg">AKWUOSE</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                  Akwuose behind Mama's Mart along Ibusa Road
                </p>
                <a 
                  href="https://maps.google.com/?q=Akwuose+Mama%27s+Mart+Ibusa+Road,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                  data-testid="link-location-4"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Extracurricular Activities Section 
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-activities-title">
              Extracurricular Activities
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-activities-description">
              Developing talents and building character beyond the classroom
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-activity-1">
              <div className="relative h-48">
                <img 
                  src={sportsImage1} 
                  alt="Students playing sports" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Dumbbell className="h-5 w-5 text-blue-600 mr-2" />
                  <CardTitle className="text-lg">Sports</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Football, Basketball, Athletics, and more sports programs to build teamwork and fitness.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-activity-2">
              <div className="relative h-48">
                <img 
                  src={sportsImage2} 
                  alt="Music and arts activities" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Music className="h-5 w-5 text-green-600 mr-2" />
                  <CardTitle className="text-lg">Music & Arts</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Creative expression through music, dance, drama, and visual arts programs.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-activity-3">
              <div className="relative h-48">
                <img 
                  src={sportsImage3} 
                  alt="Academic competitions" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Trophy className="h-5 w-5 text-purple-600 mr-2" />
                  <CardTitle className="text-lg">Competitions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Academic competitions, debates, quiz contests, and science fairs.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-activity-4">
              <div className="relative h-48">
                <img 
                  src={sportsImage4} 
                  alt="Leadership activities" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Users className="h-5 w-5 text-orange-600 mr-2" />
                  <CardTitle className="text-lg">Leadership</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Student council, peer mentoring, and leadership development programs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      */}
      {/* School Facilities Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-facilities-title">
              School Facilities
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-facilities-description">
              Modern facilities designed for optimal learning experiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-facility-1">
              <div className="relative h-48">
                <img 
                  src={libraryCardImage} 
                  alt="School library" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
                  <CardTitle className="text-lg">Library</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Well-stocked library with diverse books, research materials, and quiet study areas.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-facility-2">
              <div className="relative h-48">
                <img 
                  src={images__4_} 
                  alt="Science laboratory" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Microscope className="h-5 w-5 text-green-600 mr-2" />
                  <CardTitle className="text-lg">Science Labs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Fully equipped laboratories for Physics, Chemistry, and Biology experiments.
                </p>
              </CardContent>
            </Card>

            {/* Hidden: Computer Lab - Uncomment when ready to display
            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-facility-3">
              <div className="relative h-48">
                <img 
                  src={libraryImage2} 
                  alt="Computer laboratory" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Calculator className="h-5 w-5 text-purple-600 mr-2" />
                  <CardTitle className="text-lg">Computer Lab</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Modern computer lab with internet access for digital literacy and research.
                </p>
              </CardContent>
            </Card>
            */}

            {/* Hidden: Multi-Purpose Hall - Uncomment when ready to display
            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-facility-4">
              <div className="relative h-48">
                <img 
                  src={labImage2} 
                  alt="Multi-purpose hall" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Building className="h-5 w-5 text-orange-600 mr-2" />
                  <CardTitle className="text-lg">Multi-Purpose Hall</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Large hall for assemblies, events, performances, and community gatherings.
                </p>
              </CardContent>
            </Card>
            */}
          </div>
        </div>
      </section>
      {/* Approved Examinations Section */}
      <section className="py-20 bg-blue-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-exams-title">
              Approved Examinations
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-exams-description">
              Officially recognized examination center for national and international assessments
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow" data-testid="card-exam-1">
              <CardHeader className="text-center">
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">Common Entrance</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Approved center for Common Entrance examinations into secondary schools.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow" data-testid="card-exam-2">
              <CardHeader className="text-center">
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">BECE</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Basic Education Certificate Examination for JSS3 students.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow" data-testid="card-exam-3">
              <CardHeader className="text-center">
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">NECO</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  National Examinations Council examinations for SS3 students.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow" data-testid="card-exam-4">
              <CardHeader className="text-center">
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-lg">WAEC</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  West African Examinations Council (SSCE) for SS3 students.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-3xl mx-auto shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Examination Excellence
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                As an approved examination center, we ensure students receive proper preparation and 
                examination support for all major national and international assessments. Our experienced 
                faculty and comprehensive curriculum guarantee students are well-prepared for academic success.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Quick Links Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-quicklinks-title">
              Get Started Today
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-quicklinks-description">
              Explore our programs and join the Seat of Wisdom Academy family
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-quicklink-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GraduationCap className="mr-2 h-5 w-5 text-blue-600" />
                  Academic Programs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  Discover our comprehensive academic offerings from primary to secondary education.
                </CardDescription>
                <Link href="/programs">
                  <Button variant="outline" className="w-full" data-testid="button-view-programs">
                    View Programs
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-quicklink-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-green-600" />
                  Admissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  Learn about our admission process and requirements for new students.
                </CardDescription>
                <Link href="/admissions">
                  <Button variant="outline" className="w-full" data-testid="button-apply-today">
                    Apply Today
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-quicklink-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="mr-2 h-5 w-5 text-purple-600" />
                  Student Portal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  Access grades, assignments, and communicate with teachers through our portal.
                </CardDescription>
                <Link href="/portal">
                  <Button variant="outline" className="w-full" data-testid="button-access-portal">
                    Access Portal
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* News Section */}
      <NewsExcerptSection />
      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src={academyLogo} alt="Academy Logo" className="h-6 w-6 object-contain" />
                <span className="text-lg font-bold">Seat of Wisdom Academy</span>
              </div>
              <p className="text-gray-400" data-testid="text-footer-description">
                Nurturing minds and building futures through quality education and character development.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/programs" className="hover:text-white transition-colors">Programs</Link></li>
                <li><Link href="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center" data-testid="text-footer-phone">
                  <Phone className="h-4 w-4 mr-2" />
                  07062492861, 09112024868
                </li>
                <li className="flex items-center" data-testid="text-footer-email">
                  <Mail className="h-4 w-4 mr-2" />
                  info@seatofwisdomasaba.org
                </li>
                <li className="flex items-center" data-testid="text-footer-location">
                  <MapPin className="h-4 w-4 mr-2" />
                  Asaba, Delta State, Nigeria
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Our Branches</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/contact#branches" className="hover:text-white transition-colors" data-testid="link-footer-bonsaac">BONSAAC</Link></li>
                <li><Link href="/contact#branches" className="hover:text-white transition-colors" data-testid="link-footer-ikpoto">IKPOTO POWERLINE</Link></li>
                <li><Link href="/contact#branches" className="hover:text-white transition-colors" data-testid="link-footer-akwuofor">AKWUOFOR ALONG AMUSEMENT PARK KOKA</Link></li>
                <li><Link href="/contact#branches" className="hover:text-white transition-colors" data-testid="link-footer-akwuose">AKWUOSE BEHIND MAMA'S MART ALONG IBUSA ROAD</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p data-testid="text-footer-copyright">© 2025 Seat of Wisdom Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}