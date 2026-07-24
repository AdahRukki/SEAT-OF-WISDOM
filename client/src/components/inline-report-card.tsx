import { calculateGrade } from "@shared/schema";
import {
  generateReportCardHtml,
  getPrincipalComment,
  getBehavioralInterpretationText,
} from "@/lib/report-card-template";
import type { ReportSubjectRow } from "@/lib/report-card-template";

interface InlineReportCardProps {
  profile: any;
  assessments: any[];
  user: any;
  selectedTerm: string;
  selectedSession: string;
  calculateAge: (dateOfBirth: string | Date | null) => number | string;
  behavioralRating?: any;
  classStats?: Record<string, { classAverage: number; position: number; totalStudents: number }>;
  logoUrl?: string | null;
  principalSignatureUrl?: string | null;
  nextTermDate?: string | null;
}

function getNextClassId(currentClassId: string): string | null {
  const match = currentClassId.match(/^(SCH\d+)-([A-Z]+)(\d+)$/);
  if (!match) return null;
  const [, schoolPrefix, classType, classNumber] = match;
  const currentNumber = parseInt(classNumber);
  if (classType === "JSS") {
    if (currentNumber === 1) return `${schoolPrefix}-JSS2`;
    if (currentNumber === 2) return `${schoolPrefix}-JSS3`;
    if (currentNumber === 3) return `${schoolPrefix}-SS1`;
  } else if (classType === "SS") {
    if (currentNumber === 1) return `${schoolPrefix}-SS2`;
    if (currentNumber === 2) return `${schoolPrefix}-SS3`;
    if (currentNumber === 3) return "GRADUATE";
  } else if (classType === "PRI") {
    if (currentNumber < 6) return `${schoolPrefix}-PRI${currentNumber + 1}`;
    if (currentNumber === 6) return `${schoolPrefix}-JSS1`;
  }
  return null;
}

function buildPromotionText(classId: string): string {
  const nextClass = getNextClassId(classId);
  if (!nextClass) return "Continue to next session";
  if (nextClass === "GRADUATE") return "Congratulations! You have successfully graduated.";
  const match = nextClass.match(/^SCH\d+-([A-Z]+)(\d+)$/);
  if (match) {
    const [, classType, number] = match;
    if (classType === "JSS") return `Promoted to J.S.S ${number}`;
    if (classType === "SS") return `Promoted to S.S.S ${number}`;
    if (classType === "PRI") return `Promoted to Primary ${number}`;
  }
  return `Promoted to ${nextClass}`;
}

export function InlineReportCard({
  profile,
  assessments,
  user,
  selectedTerm,
  selectedSession,
  calculateAge,
  behavioralRating,
  classStats = {},
  logoUrl,
  principalSignatureUrl,
  nextTermDate,
}: InlineReportCardProps) {
  if (!profile) return null;

  const subjectRows: ReportSubjectRow[] = assessments.map(assessment => {
    const firstCA = Number(assessment.firstCA || 0);
    const secondCA = Number(assessment.secondCA || 0);
    const exam = Number(assessment.exam || 0);
    const total = firstCA + secondCA + exam;
    const { grade, remark } = calculateGrade(total);
    const stat = classStats[assessment.subjectId];
    return {
      name: assessment.subject?.name || assessment.subjectName || '',
      firstCA,
      secondCA,
      exam,
      total,
      grade,
      remark,
      classAverage: stat?.classAverage ?? null,
      position: stat?.position ?? null,
    };
  });

  const totalMarks = subjectRows.reduce((s, r) => s + r.total, 0);
  const averagePercentage = subjectRows.length ? (totalMarks / (subjectRows.length * 100)) * 100 : 0;
  const principalComment = getPrincipalComment(averagePercentage);
  const behavioralInterpretation = getBehavioralInterpretationText(behavioralRating);
  const ageDisplay = profile.dateOfBirth ? String(calculateAge(profile.dateOfBirth)) + ' yrs' : 'N/A';
  const studentFullName = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ');

  const promotionText = selectedTerm === 'Third Term' && profile.classId
    ? buildPromotionText(profile.classId)
    : null;

  const html = generateReportCardHtml({
    studentName: studentFullName,
    studentId: profile.studentId,
    className: profile.class?.name || '',
    gender: profile.gender || 'N/A',
    ageDisplay,
    term: selectedTerm,
    session: selectedSession,
    nextTermDate: nextTermDate || null,
    logoUrl: logoUrl || null,
    subjects: subjectRows,
    attendanceDays: null,
    behavioralRating: behavioralRating || null,
    principalComment,
    behavioralInterpretation: behavioralInterpretation || null,
    promotionText,
    principalSignatureUrl: principalSignatureUrl || null,
  });

  return (
    <div className="w-full">
      <iframe
        srcDoc={html}
        className="w-full border-none bg-white"
        style={{ height: '85vh', minHeight: 600 }}
        title="Report Card Preview"
      />
    </div>
  );
}
