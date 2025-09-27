import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Users, Calculator, Globe, Microscope, Palette, Music, Trophy, ChevronRight, Baby, School, GraduationCap as GraduationIcon } from "lucide-react";
import academyLogo from "@assets/academy-logo.png";

export default function SchoolPrograms() {
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
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/about" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</Link>
              <Link href="/programs" className="text-blue-600 dark:text-blue-400 font-medium">Programs</Link>
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
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-programs-hero-title">
            Academic <span className="text-blue-600 dark:text-blue-400">Programs</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-programs-hero-description">
            Comprehensive educational programs designed to nurture academic excellence, 
            critical thinking, and character development from nursery through secondary levels.
          </p>
        </div>
      </section>

      {/* Program Levels */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-program-levels-title">
              Educational Levels
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-program-levels-description">
              Structured learning pathways for every stage of development
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-nursery">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-orange-100 dark:bg-orange-900 rounded-full p-3">
                    <Baby className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Play Class - KG3</Badge>
                </div>
                <CardTitle className="text-2xl">Nursery Education</CardTitle>
                <CardDescription>Ages 2-6 | 4 Years</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Early childhood development through play-based learning, foundational skills, 
                  and social interaction in a nurturing environment.
                </p>
                <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <li>• Play Class (Ages 2-3)</li>
                  <li>• Kindergarten 1 (Ages 3-4)</li>
                  <li>• Kindergarten 2 (Ages 4-5)</li>
                  <li>• Kindergarten 3 (Ages 5-6)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-primary">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3">
                    <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Basic 1 - Basic 5</Badge>
                </div>
                <CardTitle className="text-2xl">Primary Education</CardTitle>
                <CardDescription>Ages 6-11 | 5 Years</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Foundation learning with focus on literacy, numeracy, and character development. 
                  Our primary program builds essential skills while fostering creativity and curiosity.
                </p>
                <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <li>• Basic 1 (Ages 6-7)</li>
                  <li>• Basic 2 (Ages 7-8)</li>
                  <li>• Basic 3 (Ages 8-9)</li>
                  <li>• Basic 4 (Ages 9-10)</li>
                  <li>• Basic 5 (Ages 10-11)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-junior-secondary">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
                    <School className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">JSS1 - JSS3</Badge>
                </div>
                <CardTitle className="text-2xl">Junior Secondary</CardTitle>
                <CardDescription>Ages 11-14 | 3 Years</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Foundation secondary education building on primary skills with introduction 
                  to specialized subjects and critical thinking development.
                </p>
                <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <li>• Junior Secondary School 1 (Ages 11-12)</li>
                  <li>• Junior Secondary School 2 (Ages 12-13)</li>
                  <li>• Junior Secondary School 3 (Ages 13-14)</li>
                  <li>• Preparation for Senior Secondary</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-senior-secondary">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-purple-100 dark:bg-purple-900 rounded-full p-3">
                    <GraduationIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">SS1 - SS3</Badge>
                </div>
                <CardTitle className="text-2xl">Senior Secondary</CardTitle>
                <CardDescription>Ages 14-17 | 3 Years</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Advanced secondary education with specialized subject combinations preparing 
                  students for university entrance and professional careers.
                </p>
                <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <li>• Senior Secondary School 1 (Ages 14-15)</li>
                  <li>• Senior Secondary School 2 (Ages 15-16)</li>
                  <li>• Senior Secondary School 3 (Ages 16-17)</li>
                  <li>• University Preparation & WAEC</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Subject Areas */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-subjects-title">
              Subject Areas & Specializations
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-subjects-description">
              Diverse curriculum options to match every student's interests and career goals
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-subject-sciences">
              <CardHeader>
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Microscope className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Sciences</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Physics</li>
                  <li>Chemistry</li>
                  <li>Biology</li>
                  <li>Mathematics</li>
                  <li>Computer Science</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-subject-languages">
              <CardHeader>
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Languages</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>English</li>
                  <li>Luganda</li>
                  <li>French</li>
                  <li>Literature</li>
                  <li>Kiswahili</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-subject-business">
              <CardHeader>
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Calculator className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Business</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Economics</li>
                  <li>Accounting</li>
                  <li>Business Studies</li>
                  <li>Entrepreneurship</li>
                  <li>Commerce</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-subject-arts">
              <CardHeader>
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <Palette className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle>Arts & Humanities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>History</li>
                  <li>Geography</li>
                  <li>Religious Education</li>
                  <li>Fine Art</li>
                  <li>Music</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Extracurricular Activities */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-extracurricular-title">
              Beyond the Classroom
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-extracurricular-description">
              Enriching activities that develop well-rounded students
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-sports">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                    <Trophy className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle>Sports & Athletics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Football, basketball, netball, athletics, swimming, and more. 
                  Regular inter-school competitions and tournaments.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-music">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 dark:bg-green-900 rounded-full p-2">
                    <Music className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle>Music & Performing Arts</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Choir, band, drama club, traditional dance, and musical instruments. 
                  Annual concerts and cultural performances.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-clubs">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 dark:bg-purple-900 rounded-full p-2">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle>Clubs & Societies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Debate club, science club, environmental club, photography, 
                  and student leadership opportunities.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Assessment System */}
      <section className="py-20 bg-blue-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-assessment-title">
              Assessment & Evaluation
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-assessment-description">
              Fair and comprehensive evaluation system
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center" data-testid="card-continuous">
              <CardHeader>
                <CardTitle className="text-xl">Continuous Assessment</CardTitle>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">20%</div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Regular assignments, quizzes, and class participation to track ongoing progress.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center" data-testid="card-midterm">
              <CardHeader>
                <CardTitle className="text-xl">Mid-term Exams</CardTitle>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">20%</div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive mid-term evaluations to assess understanding and identify areas for improvement.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center" data-testid="card-final">
              <CardHeader>
                <CardTitle className="text-xl">Final Exams</CardTitle>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">60%</div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  End-of-term examinations that evaluate comprehensive understanding of the curriculum.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-blue-600 dark:bg-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6" data-testid="text-cta-title">
            Ready to Start Your Educational Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto" data-testid="text-cta-description">
            Join thousands of students who have built successful futures through our comprehensive academic programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/admissions">
              <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100" data-testid="button-cta-apply">
                Apply Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600" data-testid="button-cta-contact">
                Get More Information
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
                <li>BONSAAC</li>
                <li>IKPOTO POWERLINE</li>
                <li>AKWUOFOR</li>
                <li>AKWUOSE</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Connect With Us</h3>
              <p className="text-gray-400 mb-2">info@seatofwisdomasaba.org</p>
              <p className="text-gray-400 mb-2">+256 123 456 789</p>
              <p className="text-gray-400">Asaba, Uganda</p>
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