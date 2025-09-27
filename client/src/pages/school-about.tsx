import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GraduationCap, Target, Eye, Heart, Award, Users, BookOpen, Menu } from "lucide-react";
import academyLogo from "@assets/academy-logo.png";

export default function SchoolAbout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</span>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-8">
                <Link href="/about" className="text-blue-600 dark:text-blue-400 font-medium">About</Link>
                <Link href="/programs" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Programs</Link>
                <Link href="/admissions" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Admissions</Link>
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
                        <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" data-testid="link-mobile-about">
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
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-about-hero-title">
            About <span className="text-blue-600 dark:text-blue-400">Seat of Wisdom Academy</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-about-hero-description">
            For over 15 years, we have been dedicated to providing quality education that shapes minds, 
            builds character, and prepares students for a successful future.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-our-story-title">
                Our Story
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6" data-testid="text-our-story-p1">
                Seat of Wisdom Academy was founded with a simple yet powerful vision: to create an educational 
                environment where every student can thrive academically, socially, and morally. What started as 
                a small school in Asaba has grown into a respected institution with four branches serving 
                communities across the region.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6" data-testid="text-our-story-p2">
                Our journey has been marked by continuous growth, innovation, and an unwavering commitment to 
                excellence. We believe that education is not just about academic achievement, but about nurturing 
                well-rounded individuals who will make positive contributions to society.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300" data-testid="text-our-story-p3">
                Today, we proudly serve over 500 students across our four branches, supported by a dedicated 
                team of more than 50 qualified educators who share our passion for transforming lives through education.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2" data-testid="text-stat-founded">2009</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Founded</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2" data-testid="text-stat-graduates">1000+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Graduates</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2" data-testid="text-stat-awards">25+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Awards</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2" data-testid="text-stat-community">4</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Communities</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-mvv-title">
              Our Foundation
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-mvv-description">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-mission">
              <CardHeader>
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <Target className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-2xl">Our Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  To provide quality, holistic education that develops intellectual, social, and moral excellence 
                  in our students, preparing them to be responsible global citizens and leaders of tomorrow.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-vision">
              <CardHeader>
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <Eye className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-2xl">Our Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  To be the leading educational institution in the region, recognized for academic excellence, 
                  character development, and producing graduates who positively impact their communities.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-values">
              <CardHeader>
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <Heart className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-2xl">Our Values</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Excellence, Integrity, Respect, Innovation, and Community. These core values shape our culture 
                  and guide our interactions with students, parents, and the broader community.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-leadership-title">
              Leadership Team
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-leadership-description">
              Experienced leaders committed to educational excellence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-principal">
              <CardHeader>
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-24 h-24 flex items-center justify-center mb-4">
                  <Users className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Dr. Sarah Namubiru</CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">Head of School</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  With over 20 years in education, Dr. Namubiru leads our institution with a vision 
                  for innovative learning and student success.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-academic">
              <CardHeader>
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-24 h-24 flex items-center justify-center mb-4">
                  <BookOpen className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Mr. James Mukasa</CardTitle>
                <CardDescription className="text-green-600 dark:text-green-400">Academic Director</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Mr. Mukasa oversees our curriculum development and ensures academic standards 
                  meet international benchmarks.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-admin">
              <CardHeader>
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-24 h-24 flex items-center justify-center mb-4">
                  <Award className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Ms. Grace Nalwoga</CardTitle>
                <CardDescription className="text-purple-600 dark:text-purple-400">Operations Manager</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Ms. Nalwoga ensures smooth operations across all our branches and maintains 
                  our high standards of service delivery.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-blue-600 dark:bg-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6" data-testid="text-cta-title">
            Join the Seat of Wisdom Family
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto" data-testid="text-cta-description">
            Discover how we can help your child reach their full potential through our comprehensive 
            educational programs and supportive community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/admissions">
              <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100" data-testid="button-cta-apply">
                Start Application
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600" data-testid="button-cta-contact">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
                <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/programs" className="hover:text-white transition-colors">Programs</Link></li>
                <li><Link href="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
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
            
            <div>
              <h3 className="font-semibold mb-4">Connect With Us</h3>
              <p className="text-gray-400 mb-2">info@seatofwisdomasaba.org</p>
              <p className="text-gray-400 mb-2">+256 123 456 789</p>
              <p className="text-gray-400">Asaba, Delta State, Nigeria</p>
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