import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queuedApiRequest } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";

type StudentForm = {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  classId: string;
  dateOfBirth: string;
  gender: string;
  profileImage: string;
  parentWhatsApp: string;
  address: string;
};

const EMPTY_FORM: StudentForm = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  classId: "",
  dateOfBirth: "",
  gender: "",
  profileImage: "",
  parentWhatsApp: "",
  address: "",
};

export default function AddStudent() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentForm, string>>>({});
  const [selectedSchoolId, setSelectedSchoolId] = useState(user?.schoolId ?? "");

  useEffect(() => {
    if (user?.schoolId) setSelectedSchoolId(user.schoolId);
  }, [user]);

  const { data: schools = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/schools"],
    enabled: user?.role === "admin",
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/classes", selectedSchoolId],
    queryFn: () =>
      apiRequest(
        user?.role === "admin" && selectedSchoolId
          ? `/api/admin/classes?schoolId=${selectedSchoolId}`
          : "/api/admin/classes"
      ),
    enabled: !!selectedSchoolId || user?.role === "sub-admin",
  });

  const validateSingleWord = (value: string) =>
    value.includes(" ") ? "Only single words allowed (no spaces)" : "";

  const handleChange = (field: keyof StudentForm, value: string) => {
    const nameFields: (keyof StudentForm)[] = ["firstName", "lastName", "middleName"];
    const processed = nameFields.includes(field) ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, [field]: processed }));
    if (nameFields.includes(field)) {
      const err = validateSingleWord(processed);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const isStep1Valid = () =>
    !!form.firstName &&
    !!form.lastName &&
    !!form.classId &&
    !errors.firstName &&
    !errors.lastName &&
    !errors.middleName;

  const isStep2Valid = () => !!form.gender && !!form.parentWhatsApp;

  const createStudentMutation = useMutation({
    mutationFn: async (data: any) =>
      queuedApiRequest(
        "/api/admin/students",
        {
          method: "POST",
          body: {
            ...data,
            parentWhatsapp: data.parentWhatsApp,
            schoolId: selectedSchoolId || user?.schoolId,
          },
        },
        "create-student"
      ),
    onSuccess: (response) => {
      if (response?.queued) {
        toast({
          title: "Saved Offline",
          description:
            "You are offline. Student will be created when you reconnect.",
        });
      } else {
        toast({
          title: "Student Created",
          description: "Student registered successfully with auto-generated SOWA ID.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!isStep1Valid() || !isStep2Valid()) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }
    createStudentMutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      middleName: form.middleName || undefined,
      email: form.email || undefined,
      password: "password@123",
      classId: form.classId,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      parentWhatsApp: form.parentWhatsApp,
      address: form.address || undefined,
      profileImage: form.profileImage || undefined,
    });
  };

  const stepColors = ["text-blue-600", "text-green-600", "text-orange-600"];
  const stepLabels = [
    "Basic Information",
    "Personal & Contact",
    "Additional (Optional)",
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-tight">
            Create New Student
          </h1>
          <p className="text-xs text-gray-500">Step {currentStep} of 3 — {stepLabels[currentStep - 1]}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-gray-800 border-b px-6 py-3 flex items-center justify-center gap-2">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step === currentStep
                  ? "bg-blue-600 text-white"
                  : step < currentStep
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
              }`}
            >
              {step < currentStep ? "✓" : step}
            </div>
            {step < 3 && (
              <div
                className={`w-12 h-1 mx-1 transition-colors ${
                  step < currentStep ? "bg-green-600" : "bg-gray-200 dark:bg-gray-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">
        {/* Admin school selector */}
        {user?.role === "admin" && (
          <div className="mb-5">
            <Label>School Branch *</Label>
            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select school branch" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className={`text-lg font-semibold text-center ${stepColors[0]}`}>
              Basic Information
            </h2>

            <div>
              <Label>Class *</Label>
              <Select
                value={form.classId}
                onValueChange={(v) => handleChange("classId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  placeholder="JOHN"
                  className={errors.firstName ? "border-red-500" : ""}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  placeholder="DOE"
                  className={errors.lastName ? "border-red-500" : ""}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-gray-600">
                Middle Name{" "}
                <span className="text-xs text-gray-400">(Optional)</span>
              </Label>
              <Input
                value={form.middleName}
                onChange={(e) => handleChange("middleName", e.target.value)}
                placeholder="Leave blank if none"
                className={errors.middleName ? "border-red-500" : ""}
              />
              {errors.middleName && (
                <p className="text-red-500 text-xs mt-1">{errors.middleName}</p>
              )}
            </div>

            <div>
              <Label>Student ID</Label>
              <Input
                value="Will be auto-generated by system"
                readOnly
                disabled
                className="bg-gray-50 text-gray-400 italic cursor-default"
              />
              <p className="text-xs text-gray-500 mt-1">
                The system assigns the next available SOWA ID automatically.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className={`text-lg font-semibold text-center ${stepColors[1]}`}>
              Personal & Contact Information
            </h2>

            <div>
              <Label>Gender *</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => handleChange("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date of Birth <span className="text-xs text-gray-400">(Optional)</span></Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={
                    form.dateOfBirth
                      ? new Date(form.dateOfBirth).getDate().toString()
                      : ""
                  }
                  onValueChange={(day) => {
                    const cur = form.dateOfBirth
                      ? new Date(form.dateOfBirth)
                      : new Date(2010, 0, 1);
                    handleChange(
                      "dateOfBirth",
                      `${cur.getFullYear()}-${(cur.getMonth() + 1)
                        .toString()
                        .padStart(2, "0")}-${day.padStart(2, "0")}`
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={
                    form.dateOfBirth
                      ? (new Date(form.dateOfBirth).getMonth() + 1).toString()
                      : ""
                  }
                  onValueChange={(month) => {
                    const cur = form.dateOfBirth
                      ? new Date(form.dateOfBirth)
                      : new Date(2010, 0, 1);
                    handleChange(
                      "dateOfBirth",
                      `${cur.getFullYear()}-${month.padStart(2, "0")}-${cur
                        .getDate()
                        .toString()
                        .padStart(2, "0")}`
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "January","February","March","April","May","June",
                      "July","August","September","October","November","December",
                    ].map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={
                    form.dateOfBirth
                      ? new Date(form.dateOfBirth).getFullYear().toString()
                      : ""
                  }
                  onValueChange={(year) => {
                    const cur = form.dateOfBirth
                      ? new Date(form.dateOfBirth)
                      : new Date(2010, 0, 1);
                    handleChange(
                      "dateOfBirth",
                      `${year}-${(cur.getMonth() + 1)
                        .toString()
                        .padStart(2, "0")}-${cur
                        .getDate()
                        .toString()
                        .padStart(2, "0")}`
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from(
                      { length: 30 },
                      (_, i) => new Date().getFullYear() - 3 - i
                    ).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Email <span className="text-xs text-gray-400">(Optional)</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john.doe@student.com"
              />
            </div>

            <div>
              <Label>Parent WhatsApp Number *</Label>
              <Input
                value={form.parentWhatsApp}
                onChange={(e) => handleChange("parentWhatsApp", e.target.value)}
                placeholder="+234 XXX XXX XXXX"
              />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2 className={`text-lg font-semibold text-center ${stepColors[2]}`}>
              Additional Information
            </h2>
            <p className="text-sm text-gray-500 text-center">
              All fields on this step are optional.
            </p>

            <div>
              <Label>Address <span className="text-xs text-gray-400">(Optional)</span></Label>
              <Input
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Student's home address"
              />
            </div>

            <div>
              <Label>Profile Photo <span className="text-xs text-gray-400">(Optional)</span></Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) =>
                      handleChange("profileImage", ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF supported</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Ready to Create Student
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Review your information and tap "Create Student" to complete registration.
              </p>
            </div>
          </div>
        )}

        {/* Bottom spacer so footer doesn't cover last field */}
        <div className="h-6" />
      </div>

      {/* Fixed bottom action bar */}
      <div className="bg-white dark:bg-gray-800 border-t px-4 py-3 flex gap-3 sticky bottom-0">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (currentStep === 1) setLocation("/");
            else setCurrentStep((s) => s - 1);
          }}
        >
          {currentStep === 1 ? "Cancel" : "← Previous"}
        </Button>

        {currentStep < 3 ? (
          <Button
            className="flex-1"
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={
              (currentStep === 1 && !isStep1Valid()) ||
              (currentStep === 2 && !isStep2Valid())
            }
          >
            Next →
          </Button>
        ) : (
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={
              createStudentMutation.isPending ||
              !isStep1Valid() ||
              !isStep2Valid()
            }
          >
            {createStudentMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Student
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
