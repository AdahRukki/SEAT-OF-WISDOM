import { calculateGrade } from "@shared/schema";

interface InlineReportCardProps {
  profile: any;
  assessments: any[];
  user: any;
  selectedTerm: string;
  selectedSession: string;
  calculateAge: (dateOfBirth: string | null) => number;
}

export function InlineReportCard({ 
  profile, 
  assessments, 
  user, 
  selectedTerm, 
  selectedSession, 
  calculateAge 
}: InlineReportCardProps) {
  if (!profile) return null;

  // Calculate totals
  const totalMarks = assessments.reduce((sum, assessment) => {
    return sum + (Number(assessment.firstCA || 0) + Number(assessment.secondCA || 0) + Number(assessment.exam || 0));
  }, 0);

  const averagePercentage = assessments.length ? (totalMarks / (assessments.length * 100) * 100).toFixed(2) : '0.00';

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden border-2 border-blue-600">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-1">SEAT OF WISDOM ACADEMY</h1>
        <p className="text-sm opacity-90 italic mb-3">"Nurturing Excellence in Learning"</p>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <h2 className="text-lg font-semibold">STUDENT REPORT CARD</h2>
        </div>
      </div>

      {/* Student Information */}
      <div className="grid grid-cols-2 gap-4 p-6 bg-gray-50 border-b-2 border-gray-200">
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">Name:</span>
          <span className="text-gray-900 ml-2">{user?.firstName} {user?.lastName}</span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">ID:</span>
          <span className="text-gray-900 ml-2">{profile.studentId}</span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">Class:</span>
          <span className="text-gray-900 ml-2">{profile.class?.name}</span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">Session:</span>
          <span className="text-gray-900 ml-2">{selectedSession}</span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">Term:</span>
          <span className="text-gray-900 ml-2">{selectedTerm}</span>
        </div>
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 min-w-20">Age:</span>
          <span className="text-gray-900 ml-2">{calculateAge(profile.dateOfBirth)} years</span>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-800 text-white">
              <th className="p-3 text-left text-sm font-bold border border-blue-700">SUBJECT</th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">
                1ST CA<br />
                <span className="text-xs">(20)</span>
              </th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">
                2ND CA<br />
                <span className="text-xs">(20)</span>
              </th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">
                EXAM<br />
                <span className="text-xs">(60)</span>
              </th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">
                TOTAL<br />
                <span className="text-xs">(100)</span>
              </th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">GRADE</th>
              <th className="p-3 text-center text-sm font-bold border border-blue-700">REMARK</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((assessment, index) => {
              const firstCA = Number(assessment.firstCA || 0);
              const secondCA = Number(assessment.secondCA || 0);
              const exam = Number(assessment.exam || 0);
              const total = firstCA + secondCA + exam;
              
              // Use the correct WAEC grading standards
              const { grade, remark } = calculateGrade(total);
              
              return (
                <tr 
                  key={assessment.id || index} 
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="p-3 text-left font-medium text-gray-700 border border-gray-300">
                    {assessment.subject.name}
                  </td>
                  <td className="p-3 text-center text-sm border border-gray-300">{firstCA}</td>
                  <td className="p-3 text-center text-sm border border-gray-300">{secondCA}</td>
                  <td className="p-3 text-center text-sm border border-gray-300">{exam}</td>
                  <td className="p-3 text-center text-sm font-bold border border-gray-300">{total}</td>
                  <td className="p-3 text-center text-sm font-bold text-blue-800 border border-gray-300">
                    {grade}
                  </td>
                  <td className="p-3 text-center text-sm border border-gray-300">{remark}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistics Section */}
      <div className="p-6 bg-blue-50 border-t-2 border-blue-600">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg text-center border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Score</div>
            <div className="text-xl font-bold text-blue-800 mt-1">{totalMarks}</div>
          </div>
          <div className="bg-white p-4 rounded-lg text-center border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Average</div>
            <div className="text-xl font-bold text-blue-800 mt-1">{averagePercentage}%</div>
          </div>
          <div className="bg-white p-4 rounded-lg text-center border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Result</div>
            <div className={`text-xl font-bold mt-1 ${Number(averagePercentage) >= 40 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(averagePercentage) >= 40 ? 'PASS' : 'FAIL'}
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-1 text-sm">
          <div>No of Subjects: <span className="font-semibold">{assessments.length}</span></div>
          <div>Total Obtainable: <span className="font-semibold">{assessments.length * 100}</span></div>
          <div>Result Status: <span className={`font-semibold ${Number(averagePercentage) >= 40 ? 'text-green-600' : 'text-red-600'}`}>
            {Number(averagePercentage) >= 40 ? 'PASS' : 'FAIL'}
          </span></div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-blue-800 text-white p-5 text-center">
        <div className="mb-4">
          <div className="font-bold text-sm">SEAT OF WISDOM ACADEMY MANAGEMENT SYSTEM</div>
        </div>
        <div className="grid grid-cols-3 gap-8 mb-4">
          <div className="text-center">
            <div className="border-t-2 border-white/30 pt-2 text-xs">Class Teacher</div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-white/30 pt-2 text-xs">Principal</div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-white/30 pt-2 text-xs">Parent/Guardian</div>
          </div>
        </div>
        <div className="text-xs opacity-80">
          Generated on {new Date().toLocaleDateString()} | Student Report
        </div>
      </div>

      {/* Print Button for the inline view */}
      <div className="p-4 bg-gray-100 border-t text-center print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
          data-testid="button-print-report"
        >
          🖨️ Print This Report Card
        </button>
      </div>
    </div>
  );
}