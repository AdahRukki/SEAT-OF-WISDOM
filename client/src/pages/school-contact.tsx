import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GraduationCap, Phone, Mail, MapPin, Clock, Send, MessageCircle, ExternalLink, Menu } from "lucide-react";
import academyLogo from "@assets/academy-logo.png";

export default function SchoolContact() {
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
                <Link href="/admissions" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Admissions</Link>
                <Link href="/contact" className="text-blue-600 dark:text-blue-400 font-medium">Contact</Link>
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
                      <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" data-testid="link-mobile-contact">
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
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-contact-hero-title">
            <span className="text-blue-600 dark:text-blue-400">Get in Touch</span> With Us
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-contact-hero-description">
            We're here to answer your questions, provide information, and help you discover 
            how Seat of Wisdom Academy can be the right choice for your child's education.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-contact-info-title">
              Multiple Ways to Connect
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-contact-info-description">
              Choose the most convenient way to reach us
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-phone-contact">
              <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <Phone className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl mb-2">Call Us</CardTitle>
              <CardDescription className="mb-4">
                Speak directly with our staff for immediate assistance
              </CardDescription>
              <div className="space-y-2">
                <p className="text-blue-600 dark:text-blue-400 font-semibold">Main Office: +256 123 456 789</p>
                <p className="text-blue-600 dark:text-blue-400 font-semibold">Admissions: +256 123 456 790</p>
              </div>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-email-contact">
              <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <Mail className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl mb-2">Email Us</CardTitle>
              <CardDescription className="mb-4">
                Send us detailed questions and we'll respond promptly
              </CardDescription>
              <div className="space-y-2">
                <p className="text-green-600 dark:text-green-400 font-semibold">info@seatofwisdomasaba.org</p>
                <p className="text-green-600 dark:text-green-400 font-semibold">admissions@seatofwisdomasaba.org</p>
              </div>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-visit-contact">
              <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <MapPin className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-xl mb-2">Visit Our Campus</CardTitle>
              <CardDescription className="mb-4">
                Schedule a tour to see our facilities and meet our team
              </CardDescription>
              <p className="text-purple-600 dark:text-purple-400 font-semibold">Four Locations in Asaba</p>
              <p className="text-gray-600 dark:text-gray-300">Asaba, Delta State, Nigeria</p>
            </Card>
          </div>

          {/* Office Hours */}
          <Card className="max-w-2xl mx-auto p-8" data-testid="card-office-hours">
            <CardHeader className="text-center">
              <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl">Office Hours</CardTitle>
              <CardDescription>When you can reach us</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Weekdays</h4>
                  <div className="space-y-2 text-gray-600 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>Monday - Friday:</span>
                      <span>8:00 AM - 5:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lunch Break:</span>
                      <span>1:00 PM - 2:00 PM</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Weekends</h4>
                  <div className="space-y-2 text-gray-600 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>Saturday:</span>
                      <span>9:00 AM - 1:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday:</span>
                      <span>Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-contact-form-title">
              Send Us a Message
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-contact-form-description">
              Fill out the form below and we'll get back to you within 24 hours
            </p>
          </div>

          <Card className="p-8" data-testid="card-contact-form">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full-name">Full Name *</Label>
                  <Input id="full-name" placeholder="Enter your full name" data-testid="input-full-name" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" placeholder="your.email@example.com" data-testid="input-email" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="+256 xxx xxx xxx" data-testid="input-phone" />
                </div>
                <div>
                  <Label htmlFor="inquiry-type">Inquiry Type *</Label>
                  <Select>
                    <SelectTrigger data-testid="select-inquiry-type">
                      <SelectValue placeholder="Select inquiry type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admissions">Admissions Information</SelectItem>
                      <SelectItem value="programs">Academic Programs</SelectItem>
                      <SelectItem value="fees">Fees and Payment</SelectItem>
                      <SelectItem value="facilities">Facilities and Services</SelectItem>
                      <SelectItem value="general">General Information</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="branch-interest">Branch of Interest</Label>
                <Select>
                  <SelectTrigger data-testid="select-branch-interest">
                    <SelectValue placeholder="Select preferred branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asaba">Asaba Main Campus</SelectItem>
                    <SelectItem value="lugazi">Lugazi Branch</SelectItem>
                    <SelectItem value="kampala">Kampala Branch</SelectItem>
                    <SelectItem value="mukono">Mukono Branch</SelectItem>
                    <SelectItem value="any">Any Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input id="subject" placeholder="Brief subject of your inquiry" data-testid="input-subject" />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea 
                  id="message" 
                  placeholder="Please provide details about your inquiry, questions, or any specific information you need..." 
                  rows={6} 
                  data-testid="textarea-message" 
                />
              </div>

              <div>
                <Label htmlFor="preferred-contact">Preferred Contact Method</Label>
                <Select>
                  <SelectTrigger data-testid="select-preferred-contact">
                    <SelectValue placeholder="How would you like us to respond?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="either">Either Email or Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-6 border-t">
                <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-send-message">
                  Send Message
                  <Send className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                  We typically respond to inquiries within 24 hours during business days.
                </p>
              </div>
            </form>
          </Card>
        </div>
      </section>

      {/* Branch Locations */}
      <section id="branches" className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-branches-title">
              Our Branch Locations
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-branches-description">
              Conveniently located to serve communities across the region
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-bonsaac">
              <div className="mb-4">
                <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">BONSAAC</CardTitle>
              <CardDescription className="mb-4">
                Bonsaac, Asaba<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>📞 +234 123 456 789</p>
                <p>✉️ bonsaac@seatofwisdomasaba.org</p>
                <a 
                  href="https://maps.google.com/?q=Bonsaac,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-bonsaac"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-ikpoto">
              <div className="mb-4">
                <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">IKPOTO POWERLINE</CardTitle>
              <CardDescription className="mb-4">
                Ikpoto Powerline, Asaba<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>📞 +234 123 456 791</p>
                <p>✉️ ikpoto@seatofwisdomasaba.org</p>
                <a 
                  href="https://maps.google.com/?q=Ikpoto+Powerline,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-ikpoto"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-akwuofor">
              <div className="mb-4">
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">AKWUOFOR</CardTitle>
              <CardDescription className="mb-4">
                Akwuofor along Amusement Park, Koka<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>📞 +234 123 456 792</p>
                <p>✉️ akwuofor@seatofwisdomasaba.org</p>
                <a 
                  href="https://maps.google.com/?q=Akwuofor+Amusement+Park+Koka,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-akwuofor"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-akwuose">
              <div className="mb-4">
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">AKWUOSE</CardTitle>
              <CardDescription className="mb-4">
                Akwuose behind Mama's Mart along Ibusa Road<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>📞 +234 123 456 793</p>
                <p>✉️ akwuose@seatofwisdomasaba.org</p>
                <a 
                  href="https://maps.google.com/?q=Akwuose+Mama%27s+Mart+Ibusa+Road,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-akwuose"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-blue-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-faq-description">
              Quick answers to common questions
            </p>
          </div>

          <div className="space-y-6">
            <Card className="p-6" data-testid="card-faq-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 text-blue-600 mr-2" />
                  What are your admission requirements?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Requirements vary by level. Generally, we need academic transcripts, identification documents, 
                  and relevant certificates. Visit our admissions page for detailed requirements by education level.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6" data-testid="card-faq-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 text-blue-600 mr-2" />
                  Can I transfer my child from one branch to another?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Yes, we allow transfers between our four branches in Asaba. Contact our main office to discuss 
                  availability and complete the transfer process. We'll ensure a smooth transition for your child.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6" data-testid="card-faq-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 text-blue-600 mr-2" />
                  Can I transfer my child from another school?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Absolutely! We welcome transfer students. You'll need to provide academic transcripts, 
                  a transfer letter from the previous school, and meet our placement assessment requirements.
                </p>
              </CardContent>
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