import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Menu, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import academyLogo from "@assets/academy-logo.png";

const SUBJECT_GROUPS: { group: string; subjects: string[] }[] = [
  { group: "Sciences", subjects: ["Mathematics", "Physics", "Chemistry", "Biology"] },
  { group: "Arts/Humanities", subjects: ["English Language", "Literature-in-English", "Government", "History", "CRS", "French"] },
  { group: "Business", subjects: ["Economics", "Financial Accounting", "Commerce"] },
];

// Subjects section only shown for JSS or SS
const SECONDARY_POSITIONS = ["JSS", "SS"];

const careersFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(7, "Phone number is required"),
  homeAddress: z.string().optional(),
  position: z.string().min(1, "Please select a position"),
  preferredBranch: z.string().min(1, "Please select a preferred branch"),
  subjects: z.array(z.string()).default([]),
  otherSubject: z.string().optional(),
  highestQualification: z.string().min(1, "Please select your highest qualification"),
  confirmAccuracy: z.boolean().refine((v) => v === true, {
    message: "You must confirm that the information provided is accurate",
  }),
  website: z.string().optional(), // honeypot — must stay empty
});

type CareersFormData = z.infer<typeof careersFormSchema>;

export default function SchoolCareers() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: branches = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/public/branches"],
  });

  const form = useForm<CareersFormData>({
    resolver: zodResolver(careersFormSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      homeAddress: "",
      position: "",
      preferredBranch: "",
      subjects: [],
      otherSubject: "",
      highestQualification: "",
      confirmAccuracy: false,
      website: "",
    },
  });

  const position = form.watch("position");
  const showSubjects = SECONDARY_POSITIONS.includes(position);

  const submitMutation = useMutation({
    mutationFn: async (data: CareersFormData) => {
      const fd = new FormData();
      fd.append("fullName", data.fullName);
      fd.append("phone", data.phone);
      if (data.homeAddress) fd.append("homeAddress", data.homeAddress);
      fd.append("position", data.position);
      fd.append("preferredBranch", data.preferredBranch);
      fd.append("subjects", JSON.stringify(showSubjects ? data.subjects : []));
      if (showSubjects && data.otherSubject) fd.append("otherSubject", data.otherSubject);
      fd.append("highestQualification", data.highestQualification);
      fd.append("confirmAccuracy", data.confirmAccuracy ? "true" : "false");
      if (data.website) fd.append("website", data.website);
      if (cvFile) fd.append("cv", cvFile);

      const res = await fetch("/api/public/careers", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit application");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({
        title: "Application Submitted!",
        description: "Thank you for applying. Only shortlisted candidates will be contacted.",
      });
      form.reset();
      setCvFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CareersFormData) => {
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
                <Link href="/careers" className="text-blue-600 dark:text-blue-400 font-medium">Careers</Link>
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
                      <Link href="/careers" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" data-testid="link-mobile-careers">
                          Careers
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
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-careers-hero-title">
            Join Our Team – <span className="text-blue-600 dark:text-blue-400">Teaching Vacancies</span> at Seat of Wisdom Academy
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-careers-hero-description">
            Seat of Wisdom Academy is a multi-branch, WAEC/NECO-accredited private school in Asaba, Delta State,
            offering quality education from Pre-Nursery through Secondary school. We are always looking for
            passionate, qualified, and dedicated teachers to join our growing team across our branches.
          </p>
        </div>
      </section>

      {/* Why Teach With Us */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-why-teach-title">
            Why Teach With Us
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300" data-testid="text-why-teach-summary">
            Supportive environment &bull; Growth across branches &bull; Strong values-based culture &bull; Modern facilities
          </p>
        </div>
      </section>

      {/* Current Openings */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-6" data-testid="text-openings-title">
            Current Openings
          </h2>
          <Card className="p-8" data-testid="card-current-openings">
            <p className="text-xl text-gray-600 dark:text-gray-300">
              We accept applications on a rolling basis for all subjects and levels — Nursery, Primary, and
              Secondary (JSS/SS).
            </p>
          </Card>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="text-application-title">
              Application Form
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300" data-testid="text-application-description">
              Complete this form to apply for a teaching position
            </p>
          </div>

          {submitted ? (
            <Card className="p-12 text-center" data-testid="card-application-success">
              <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-4 w-20 h-20 flex items-center justify-center mb-6">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Application Submitted Successfully!</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Thank you for applying to teach at Seat of Wisdom Academy. Only shortlisted candidates will be
                contacted for an interview.
              </p>
              <Button onClick={() => setSubmitted(false)} variant="outline" data-testid="button-submit-another">
                Submit Another Application
              </Button>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8" data-testid="card-application-form">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Honeypot field — hidden from real users */}
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
                        <label htmlFor="website-field">Website</label>
                        <input id="website-field" type="text" tabIndex={-1} autoComplete="off" {...field} />
                      </div>
                    )}
                  />

                  {/* Personal Information */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
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
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="+234 xxx xxx xxxx" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="homeAddress"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Home Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your home address (optional)" {...field} data-testid="input-home-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Position Details */}
                  <div className="pt-6 border-t">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Position Details</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Position Applied For *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-position">
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Nursery">Nursery</SelectItem>
                                <SelectItem value="Primary">Primary</SelectItem>
                                <SelectItem value="JSS">JSS</SelectItem>
                                <SelectItem value="SS">SS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="preferredBranch"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Branch *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-preferred-branch">
                                  <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {branches.map((branch) => (
                                  <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {showSubjects && (
                      <div className="mt-6 p-4 sm:p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800" data-testid="section-subjects">
                        <FormField
                          control={form.control}
                          name="subjects"
                          render={() => (
                            <FormItem>
                              <FormLabel className="text-base">Subjects You Can Teach</FormLabel>
                              <div className="space-y-4 mt-2">
                                {SUBJECT_GROUPS.map(({ group, subjects }) => (
                                  <div key={group}>
                                    <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">{group}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      {subjects.map((subject) => (
                                        <FormField
                                          key={subject}
                                          control={form.control}
                                          name="subjects"
                                          render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(subject)}
                                                  onCheckedChange={(checked) => {
                                                    const current = field.value || [];
                                                    field.onChange(
                                                      checked
                                                        ? [...current, subject]
                                                        : current.filter((s) => s !== subject)
                                                    );
                                                  }}
                                                  data-testid={`checkbox-subject-${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                                                />
                                              </FormControl>
                                              <FormLabel className="text-sm font-normal cursor-pointer">{subject}</FormLabel>
                                            </FormItem>
                                          )}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="mt-4">
                          <FormField
                            control={form.control}
                            name="otherSubject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Other Subject (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Computer Studies, Agric Science, Fine Art" {...field} data-testid="input-other-subject" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Qualifications */}
                  <div className="pt-6 border-t">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Qualifications</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="highestQualification"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Highest Educational Qualification *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-highest-qualification">
                                  <SelectValue placeholder="Select qualification" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="NCE">NCE</SelectItem>
                                <SelectItem value="B.Ed/B.A/B.Sc">B.Ed / B.A / B.Sc</SelectItem>
                                <SelectItem value="PGDE">PGDE</SelectItem>
                                <SelectItem value="M.Ed">M.Ed</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1">
                          Upload CV/Resume
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          Optional — if you don't have a CV, just fill the fields above.
                        </p>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                          data-testid="input-cv-upload"
                        />
                        {cvFile && <p className="text-sm text-green-600 mt-1">Selected: {cvFile.name}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Consent */}
                  <div className="pt-6 border-t">
                    <FormField
                      control={form.control}
                      name="confirmAccuracy"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-confirm-accuracy"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer">
                              I confirm that the information provided is accurate and true. *
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-6"
                      disabled={submitMutation.isPending}
                      data-testid="button-submit-application"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Application"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          )}

          {/* Footer note */}
          <p className="text-center text-gray-500 dark:text-gray-400 mt-8" data-testid="text-careers-footer-note">
            Only shortlisted candidates will be contacted for an interview. For enquiries, contact us at{" "}
            <a href="mailto:admin@seatofwisdomacademy.com" className="text-blue-600 hover:underline">admin@seatofwisdomacademy.com</a>{" "}
            or 07062492861 / 09112024868 (call or WhatsApp).
          </p>
        </div>
      </section>
    </div>
  );
}
