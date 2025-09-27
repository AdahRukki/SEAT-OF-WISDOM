import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GraduationCap, FileText, Calendar, DollarSign, Clock, CheckCircle, Phone, Mail, MapPin, Menu } from "lucide-react";
import academyLogo from "@assets/academy-logo.png";

export default function SchoolAdmissions() {
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
                <Link href="/about" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About</Link>
                <Link href="/programs" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Programs</Link>
                <Link href="/admissions" className="text-blue-600 dark:text-blue-400 font-medium">Admissions</Link>
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
                        <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" data-testid="link-mobile-admissions">
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
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-admissions-hero-title">
            Join Our <span className="text-blue-600 dark:text-blue-400">Academic Community</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-admissions-hero-description">
            Start your educational journey with us. We welcome students from all backgrounds 
            who are ready to excel academically and grow as individuals.
          </p>
        </div>
      </section>

      {/* Admission Process */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-process-title">
              Simple Admission Process
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-process-description">
              Getting started is easy with our streamlined application process
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-step-1">
              <CardHeader>
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <CardTitle>Submit Application</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Complete our online application form with student details and academic history.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-step-2">
              <CardHeader>
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">2</span>
                </div>
                <CardTitle>Document Review</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Our admissions team reviews your application and supporting documents.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-step-3">
              <CardHeader>
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">3</span>
                </div>
                <CardTitle>Interview & Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Student interview and placement assessment to determine appropriate class level.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow" data-testid="card-step-4">
              <CardHeader>
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">4</span>
                </div>
                <CardTitle>Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Complete enrollment with fee payment and receive welcome materials.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-requirements-title">
              Admission Requirements
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-requirements-description">
              What you need to apply to our programs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="hover:shadow-lg transition-shadow" data-testid="card-primary-req">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Nursery</Badge>
                </div>
                <CardTitle>Nursery Education (Play Class-KG3)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Birth certificate or valid identification</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Immunization records</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Parent/guardian identification</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Recent passport photographs</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-primary-req">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Primary</Badge>
                </div>
                <CardTitle>Primary Education (Basic 1-5)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Age-appropriate entry assessment</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Previous school report (if applicable)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Birth certificate</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Passport photographs</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-olevel-req">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Junior Secondary</Badge>
                </div>
                <CardTitle>Junior Secondary (JSS1-JSS3)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Primary education completion certificate</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Academic transcripts from previous school</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Transfer letter (if applicable)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Disciplinary record</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="card-alevel-req">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Senior Secondary</Badge>
                </div>
                <CardTitle>Senior Secondary (SS1-SS3)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Junior Secondary completion certificate</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Good performance in JSS examinations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Subject combination preference</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Recommendation letter</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-application-title">
              Apply Now
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-application-description">
              Complete this form to begin your application process
            </p>
          </div>

          <Card className="p-8" data-testid="card-application-form">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="student-name">Student Full Name *</Label>
                  <Input id="student-name" placeholder="Enter student's full name" data-testid="input-student-name" />
                </div>
                <div>
                  <Label htmlFor="date-of-birth">Date of Birth *</Label>
                  <Input id="date-of-birth" type="date" data-testid="input-date-of-birth" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="level">Applying for Level *</Label>
                  <Select>
                    <SelectTrigger data-testid="select-level">
                      <SelectValue placeholder="Select education level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="playclass">Play Class</SelectItem>
                      <SelectItem value="kg1">Kindergarten 1 (KG1)</SelectItem>
                      <SelectItem value="kg2">Kindergarten 2 (KG2)</SelectItem>
                      <SelectItem value="kg3">Kindergarten 3 (KG3)</SelectItem>
                      <SelectItem value="basic1">Basic 1</SelectItem>
                      <SelectItem value="basic2">Basic 2</SelectItem>
                      <SelectItem value="basic3">Basic 3</SelectItem>
                      <SelectItem value="basic4">Basic 4</SelectItem>
                      <SelectItem value="basic5">Basic 5</SelectItem>
                      <SelectItem value="jss1">Junior Secondary 1 (JSS1)</SelectItem>
                      <SelectItem value="jss2">Junior Secondary 2 (JSS2)</SelectItem>
                      <SelectItem value="jss3">Junior Secondary 3 (JSS3)</SelectItem>
                      <SelectItem value="ss1">Senior Secondary 1 (SS1)</SelectItem>
                      <SelectItem value="ss2">Senior Secondary 2 (SS2)</SelectItem>
                      <SelectItem value="ss3">Senior Secondary 3 (SS3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="branch">Preferred Branch *</Label>
                  <Select>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asaba">Asaba Main Campus</SelectItem>
                      <SelectItem value="lugazi">Lugazi Branch</SelectItem>
                      <SelectItem value="kampala">Kampala Branch</SelectItem>
                      <SelectItem value="mukono">Mukono Branch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="previous-school">Previous School</Label>
                  <Input id="previous-school" placeholder="Name of previous school" data-testid="input-previous-school" />
                </div>
              </div>

              <div>
                <Label htmlFor="parent-name">Parent/Guardian Name *</Label>
                <Input id="parent-name" placeholder="Enter parent/guardian full name" data-testid="input-parent-name" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="parent-phone">Phone Number *</Label>
                  <Input id="parent-phone" placeholder="+256 xxx xxx xxx" data-testid="input-parent-phone" />
                </div>
                <div>
                  <Label htmlFor="parent-email">Email Address</Label>
                  <Input id="parent-email" type="email" placeholder="parent@example.com" data-testid="input-parent-email" />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Home Address *</Label>
                <Textarea id="address" placeholder="Enter complete home address" rows={3} data-testid="textarea-address" />
              </div>

              <div>
                <Label htmlFor="special-needs">Special Needs or Medical Conditions</Label>
                <Textarea id="special-needs" placeholder="Please describe any special needs, medical conditions, or dietary requirements" rows={3} data-testid="textarea-special-needs" />
              </div>

              <div className="pt-6 border-t">
                <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-submit-application">
                  Submit Application
                  <FileText className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                  By submitting this form, you agree to our terms and conditions. 
                  Our admissions team will contact you within 2-3 business days.
                </p>
              </div>
            </form>
          </Card>
        </div>
      </section>

      {/* Important Dates & Fees */}
      <section className="py-20 bg-blue-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <Card className="p-8" data-testid="card-important-dates">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-8 w-8 text-blue-600" />
                  <CardTitle className="text-2xl">Important Dates</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Application Deadline:</span>
                  <span className="text-blue-600 dark:text-blue-400">December 15, 2025</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Term 1 Begins:</span>
                  <span className="text-blue-600 dark:text-blue-400">February 3, 2026</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Term 2 Begins:</span>
                  <span className="text-blue-600 dark:text-blue-400">May 12, 2026</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Term 3 Begins:</span>
                  <span className="text-blue-600 dark:text-blue-400">September 7, 2026</span>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8" data-testid="card-fee-structure">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <CardTitle className="text-2xl">Fee Structure</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Nursery (Play Class-KG3):</span>
                  <span className="text-green-600 dark:text-green-400">UGX 600,000/term</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Primary (Basic 1-5):</span>
                  <span className="text-green-600 dark:text-green-400">UGX 800,000/term</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Junior Secondary (JSS1-JSS3):</span>
                  <span className="text-green-600 dark:text-green-400">UGX 1,200,000/term</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Senior Secondary (SS1-SS3):</span>
                  <span className="text-green-600 dark:text-green-400">UGX 1,500,000/term</span>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Fees include tuition, meals, and learning materials. 
                    Payment plans available upon request.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-contact-admissions-title">
              Need Help with Your Application?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-contact-admissions-description">
              Our admissions team is here to assist you
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8" data-testid="card-contact-phone">
              <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <Phone className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Call Us</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Speak directly with our admissions officers
              </p>
              <p className="text-blue-600 dark:text-blue-400 font-semibold">+256 123 456 789</p>
            </Card>

            <Card className="text-center p-8" data-testid="card-contact-email">
              <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <Mail className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Email Us</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Send us your questions anytime
              </p>
              <p className="text-green-600 dark:text-green-400 font-semibold">admissions@seatofwisdomasaba.org</p>
            </Card>

            <Card className="text-center p-8" data-testid="card-contact-visit">
              <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <MapPin className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Visit Us</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Schedule a campus tour
              </p>
              <p className="text-purple-600 dark:text-purple-400 font-semibold">Asaba Main Campus</p>
            </Card>
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
              <p className="text-gray-400 mb-2">admissions@seatofwisdomasaba.org</p>
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