import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GraduationCap, Phone, Mail, MapPin, Clock, Send, MessageCircle, ExternalLink, Menu, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import academyLogo from "@assets/academy-logo.png";

const contactFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  inquiryType: z.string().min(1, "Please select an inquiry type"),
  message: z.string().min(10, "Please provide more details in your message"),
  preferredContact: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function SchoolContact() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      inquiryType: "",
      message: "",
      preferredContact: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest("/api/public/contact", { method: "POST", body: data });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Message Sent!",
        description: "Thank you for contacting us. We'll get back to you within 24 hours.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    submitMutation.mutate(data);
  };

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
                    <Link href="/portal" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xl font-bold h-16 shadow-lg border border-blue-500" data-testid="button-mobile-portal">
                        Student Portal Login
                      </Button>
                    </Link>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                    
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
                        <Button variant="ghost" className="w-full justify-start text-lg h-12 text-blue-600" data-testid="link-mobile-contact">
                          Contact
                        </Button>
                      </Link>
                      <Link href="/news" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12" data-testid="link-mobile-news">
                          News
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
      <section className="relative py-20 lg:py-28 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6" data-testid="text-hero-title">
            Get In Touch
          </h1>
          <p className="text-xl lg:text-2xl opacity-90 max-w-3xl mx-auto" data-testid="text-hero-description">
            We're here to answer your questions, provide information, and help you discover 
            the Seat of Wisdom Academy difference.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-phone-contact">
              <div className="mx-auto bg-blue-100 dark:bg-blue-900 rounded-full p-4 w-16 h-16 flex items-center justify-center mb-6">
                <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl mb-2">Call Us</CardTitle>
              <CardDescription className="text-lg">
                +234 816 330 9192<br />
                Mon-Fri, 8AM-5PM
              </CardDescription>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-email-contact">
              <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-16 h-16 flex items-center justify-center mb-6">
                <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl mb-2">Email Us</CardTitle>
              <CardDescription className="text-lg">
                admin@seatofwisdomacademy.com<br />
                Response within 24 hours
              </CardDescription>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow" data-testid="card-whatsapp-contact">
              <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-4 w-16 h-16 flex items-center justify-center mb-6">
                <MessageCircle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-xl mb-2">WhatsApp</CardTitle>
              <CardDescription className="text-lg">
                +234 816 330 9192<br />
                Quick responses
              </CardDescription>
            </Card>
          </div>

          {/* Office Hours */}
          <Card className="p-8" data-testid="card-office-hours">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-2xl">Office Hours</CardTitle>
              </div>
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

          {submitted ? (
            <Card className="p-12 text-center" data-testid="card-success-message">
              <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Message Sent Successfully!</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Thank you for reaching out. We've received your message and will get back to you within 24 hours.
              </p>
              <Button onClick={() => setSubmitted(false)} variant="outline" data-testid="button-send-another">
                Send Another Message
              </Button>
            </Card>
          ) : (
            <Card className="p-8" data-testid="card-contact-form">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} data-testid="input-full-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="your.email@example.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+234 xxx xxx xxxx" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="inquiryType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inquiry Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-inquiry-type">
                                <SelectValue placeholder="Select inquiry type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Admissions Information">Admissions Information</SelectItem>
                              <SelectItem value="Academic Programs">Academic Programs</SelectItem>
                              <SelectItem value="Fees and Payment">Fees and Payment</SelectItem>
                              <SelectItem value="Facilities and Services">Facilities and Services</SelectItem>
                              <SelectItem value="General Information">General Information</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Please provide details about your inquiry, questions, or any specific information you need..." 
                            rows={6} 
                            {...field}
                            data-testid="textarea-message" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Contact Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-preferred-contact">
                              <SelectValue placeholder="How would you like us to respond?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="Phone">Phone Call</SelectItem>
                            <SelectItem value="Either">Either Email or Phone</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-6 border-t">
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                      disabled={submitMutation.isPending}
                      data-testid="button-send-message"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                      We typically respond to inquiries within 24 hours during business days.
                    </p>
                  </div>
                </form>
              </Form>
            </Card>
          )}
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
                <p>+234 816 330 9192</p>
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
                <p>+234 816 330 9192</p>
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

            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-cable">
              <div className="mb-4">
                <div className="mx-auto bg-orange-100 dark:bg-orange-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">CABLE POINT</CardTitle>
              <CardDescription className="mb-4">
                Cable Point, Asaba<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>+234 816 330 9192</p>
                <a 
                  href="https://maps.google.com/?q=Cable+Point,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-cable"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow" data-testid="card-branch-okpanam">
              <div className="mb-4">
                <div className="mx-auto bg-purple-100 dark:bg-purple-900 rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <CardTitle className="text-lg mb-2">OKPANAM</CardTitle>
              <CardDescription className="mb-4">
                Okpanam, Asaba<br />
                Delta State, Nigeria
              </CardDescription>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>+234 816 330 9192</p>
                <a 
                  href="https://maps.google.com/?q=Okpanam,+Asaba,+Delta+State,+Nigeria" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm mt-2"
                  data-testid="link-maps-okpanam"
                >
                  View on Google Maps
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src={academyLogo} alt="Academy Logo" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold">Seat of Wisdom Academy</span>
              </div>
              <p className="text-gray-400">
                Nurturing minds, building futures. Excellence in education since establishment.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/programs" className="hover:text-white transition-colors">Programs</Link></li>
                <li><Link href="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
                <li><Link href="/news" className="hover:text-white transition-colors">News</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>+234 816 330 9192</li>
                <li>admin@seatofwisdomacademy.com</li>
                <li>Asaba, Delta State, Nigeria</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Student Portal</h4>
              <Link href="/portal">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Login to Portal
                </Button>
              </Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Seat of Wisdom Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
