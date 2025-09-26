import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, BookOpen, Trophy, MapPin, Phone, Mail, ChevronRight, Baby, School, GraduationCap as GraduationIcon, Grid3X3 } from "lucide-react";
import schoolBuilding1 from "@assets/stock_images/modern_school_buildi_77850497.jpg";
import schoolBuilding2 from "@assets/stock_images/modern_school_buildi_a486f75c.jpg";
import classroomImage1 from "@assets/stock_images/children_in_classroo_646d36b7.jpg";
import classroomImage2 from "@assets/stock_images/children_in_classroo_aaa62f0f.jpg";
import classroomImage3 from "@assets/stock_images/children_in_classroo_d7f501cb.jpg";
import classroomImage4 from "@assets/stock_images/children_in_classroo_7e1fd1a4.jpg";
import classroomImage5 from "@assets/stock_images/children_in_classroo_ebca6607.jpg";
import classroomImage6 from "@assets/stock_images/children_in_classroo_cd155654.jpg";

export default function SchoolHomepage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Seat of Wisdom Academy</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/about" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</Link>
              <Link href="/programs" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Programs</Link>
              <Link href="/admissions" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Admissions</Link>
              <Link href="/contact" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</Link>
              <Link href="/portal">
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-portal-login">
                  Student Portal
                </Button>
              </Link>
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
                <Link href="/programs">
                  <Button size="lg" variant="outline" data-testid="button-learn-more">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                <img 
                  src={schoolBuilding1} 
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
              <div className="relative h-48">
                <img 
                  src={classroomImage1} 
                  alt="Nursery students learning" 
                  className="w-full h-full object-cover"
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
                  <li>• Play Class (Ages 2-3)</li>
                  <li>• Kindergarten 1 (Ages 3-4)</li>
                  <li>• Kindergarten 2 (Ages 4-5)</li>
                  <li>• Kindergarten 3 (Ages 5-6)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-primary">
              <div className="relative h-48">
                <img 
                  src={classroomImage2} 
                  alt="Primary students in classroom" 
                  className="w-full h-full object-cover"
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
                  <li>• Basic 1 (Ages 6-7)</li>
                  <li>• Basic 2 (Ages 7-8)</li>
                  <li>• Basic 3 (Ages 8-9)</li>
                  <li>• Basic 4 (Ages 9-10)</li>
                  <li>• Basic 5 (Ages 10-11)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow overflow-hidden" data-testid="card-secondary">
              <div className="relative h-48">
                <img 
                  src={classroomImage3} 
                  alt="Secondary students studying" 
                  className="w-full h-full object-cover"
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
                  <li>• Junior Secondary (JSS1-3)</li>
                  <li>• Senior Secondary (SS1-3)</li>
                  <li>• Science & Arts Combinations</li>
                  <li>• University Preparation</li>
                </ul>
              </CardContent>
            </Card>
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

      {/* Gallery Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-gallery-title">
              Campus Life Gallery
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-gallery-description">
              A glimpse into our vibrant learning environment and student activities
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative group overflow-hidden rounded-lg shadow-lg" data-testid="gallery-item-1">
              <img 
                src={schoolBuilding2} 
                alt="School campus exterior" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-semibold">School Campus</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-lg shadow-lg" data-testid="gallery-item-2">
              <img 
                src={classroomImage4} 
                alt="Students in classroom" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-semibold">Classroom Learning</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-lg shadow-lg" data-testid="gallery-item-3">
              <img 
                src={classroomImage5} 
                alt="Student activities" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-semibold">Interactive Learning</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-lg shadow-lg md:col-span-2" data-testid="gallery-item-4">
              <img 
                src={classroomImage6} 
                alt="School facilities" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-semibold">Modern Facilities</p>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-lg shadow-lg" data-testid="gallery-item-5">
              <img 
                src={schoolBuilding1} 
                alt="Students outdoor activities" 
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-semibold">Campus Grounds</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/contact">
              <Button size="lg" variant="outline" data-testid="button-visit-campus">
                Schedule a Campus Visit
                <ChevronRight className="ml-2 h-4 w-4" />
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
                <GraduationCap className="h-6 w-6 text-blue-400" />
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
                  +256 123 456 789
                </li>
                <li className="flex items-center" data-testid="text-footer-email">
                  <Mail className="h-4 w-4 mr-2" />
                  info@seatofwisdomasaba.org
                </li>
                <li className="flex items-center" data-testid="text-footer-location">
                  <MapPin className="h-4 w-4 mr-2" />
                  Asaba, Uganda
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Our Branches</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Asaba Main Campus</li>
                <li>Lugazi Branch</li>
                <li>Kampala Branch</li>
                <li>Mukono Branch</li>
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