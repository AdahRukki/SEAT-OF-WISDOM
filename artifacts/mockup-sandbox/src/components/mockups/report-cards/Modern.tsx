import React from "react";
import { Printer } from "lucide-react";

export function Modern() {
  const student = {
    name: "Emeka James Adeyemi",
    id: "SWA/2023/1042",
    class: "SS2B",
    gender: "Male",
    age: "16",
    nextTerm: "January 8, 2026",
    term: "First Term",
    session: "2025/2026",
  };

  const subjects = [
    { name: "Mathematics", ca1: 18, ca2: 55, exam: 58, total: 91, grade: "A1", remark: "Excellent" },
    { name: "English Language", ca1: 15, ca2: 48, exam: 52, total: 78, grade: "A1", remark: "Excellent" },
    { name: "Physics", ca1: 16, ca2: 50, exam: 45, total: 77, grade: "A1", remark: "Excellent" },
    { name: "Chemistry", ca1: 14, ca2: 45, exam: 50, total: 72, grade: "B2", remark: "Very Good" },
    { name: "Biology", ca1: 12, ca2: 40, exam: 48, total: 60, grade: "C4", remark: "Credit" },
    { name: "Further Mathematics", ca1: 19, ca2: 58, exam: 59, total: 96, grade: "A1", remark: "Excellent" },
    { name: "Civic Education", ca1: 15, ca2: 52, exam: 40, total: 67, grade: "B3", remark: "Good" },
    { name: "Data Processing", ca1: 17, ca2: 55, exam: 55, total: 87, grade: "A1", remark: "Excellent" },
  ];

  const behavior = [
    { name: "Attendance/Punctuality", score: 5 },
    { name: "Neatness", score: 4 },
    { name: "Respect", score: 5 },
    { name: "Participation", score: 4 },
    { name: "Responsibility", score: 5 },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800 print:bg-white print:py-0 print:px-0">
      {/* A4 Container */}
      <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl relative overflow-hidden print:shadow-none print:w-full print:h-auto">
        
        {/* Top Accent Bar */}
        <div className="h-2 w-full bg-orange-500 absolute top-0 left-0"></div>

        {/* Header - Navy/Charcoal block */}
        <div className="bg-slate-900 text-white p-8 pt-10 flex items-center justify-between relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
          
          <div className="flex items-center gap-6 relative z-10">
            {/* Logo Placeholder */}
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
              <div className="w-full h-full border-4 border-orange-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xl tracking-tighter">
                SWA
              </div>
            </div>
            
            <div>
              <h1 className="text-3xl font-black tracking-tight mb-1 text-white">SEAT OF WISDOM ACADEMY</h1>
              <p className="text-slate-300 text-sm mb-2 font-medium tracking-wide">12 Knowledge Avenue, Asaba, Delta State</p>
              <div className="inline-block bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                "The Fear of the Lord is the Beginning of Wisdom"
              </div>
            </div>
          </div>
          
          <div className="text-right relative z-10">
            <h2 className="text-2xl font-bold text-orange-400 mb-1">TERMINAL REPORT</h2>
            <p className="text-slate-300 font-medium">{student.term}</p>
            <p className="text-slate-300 font-medium">{student.session} Session</p>
          </div>
        </div>

        <div className="p-10 space-y-8">
          
          {/* Student Info - Modern Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 bg-slate-50 rounded-xl p-5 border-l-4 border-orange-500 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Student Name</p>
                <p className="text-xl font-bold text-slate-900">{student.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Student ID</p>
                <p className="text-lg font-bold text-slate-700">{student.id}</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Class</p>
              <p className="text-lg font-bold text-slate-900">{student.class}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Gender / Age</p>
              <p className="text-lg font-bold text-slate-900">{student.gender}, {student.age} yrs</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Next Term Begins</p>
              <p className="text-lg font-bold text-slate-900">{student.nextTerm}</p>
            </div>
          </div>

          {/* Summary Stats - Bold Numbers */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <p className="text-slate-400 font-semibold mb-2">Total Score</p>
              <p className="text-5xl font-black text-white">628</p>
              <p className="text-sm text-slate-400 mt-2">out of 800</p>
            </div>
            <div className="bg-orange-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <p className="text-orange-100 font-semibold mb-2">Average</p>
              <p className="text-5xl font-black text-white">78.5%</p>
              <p className="text-sm text-orange-100 mt-2">Class Avg: 65.2%</p>
            </div>
            <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
              <p className="text-slate-500 font-semibold mb-2">Attendance</p>
              <p className="text-5xl font-black text-slate-900">98%</p>
              <p className="text-sm text-slate-500 mt-2">115 of 118 days</p>
            </div>
          </div>

          {/* Academic Performance Table */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">📚</span>
              Academic Performance
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900 text-white uppercase font-bold text-xs">
                  <tr>
                    <th className="px-5 py-4 w-1/3 rounded-tl-xl">Subject</th>
                    <th className="px-3 py-4 text-center text-slate-300">1st CA <br/><span className="text-[10px] font-normal">(20)</span></th>
                    <th className="px-3 py-4 text-center text-slate-300">2nd CA <br/><span className="text-[10px] font-normal">(60)</span></th>
                    <th className="px-3 py-4 text-center text-slate-300">Exam <br/><span className="text-[10px] font-normal">(60)</span></th>
                    <th className="px-4 py-4 text-center text-orange-400">Total <br/><span className="text-[10px] font-normal">(100)</span></th>
                    <th className="px-3 py-4 text-center">Grade</th>
                    <th className="px-5 py-4 rounded-tr-xl">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {subjects.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                      <td className="px-5 py-3 font-semibold text-slate-900">{sub.name}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{sub.ca1}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{sub.ca2}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{sub.exam}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-50">{sub.total}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                          sub.grade.includes('A') ? 'bg-green-100 text-green-700' :
                          sub.grade.includes('B') ? 'bg-blue-100 text-blue-700' :
                          sub.grade.includes('C') ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {sub.grade}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-sm">{sub.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Behavioral Assessment */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">🎯</span>
                Behavioral Assessment
              </h3>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="space-y-4">
                  {behavior.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <div 
                            key={star} 
                            className={`w-4 h-4 rounded-sm ${star <= item.score ? 'bg-orange-500' : 'bg-slate-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-4 text-right">Rating: 1 (Poor) to 5 (Excellent)</p>
              </div>
            </div>

            {/* WAEC Grade Key */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">📋</span>
                Grade Key
              </h3>
              <div className="bg-slate-900 rounded-xl p-5 text-white grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div className="flex justify-between"><span className="font-bold text-orange-400">A1 (75-100)</span> <span>Excellent</span></div>
                <div className="flex justify-between"><span className="font-bold text-slate-300">C6 (50-54)</span> <span>Credit</span></div>
                <div className="flex justify-between"><span className="font-bold text-orange-400">B2 (70-74)</span> <span>Very Good</span></div>
                <div className="flex justify-between"><span className="font-bold text-slate-300">D7 (45-49)</span> <span>Pass</span></div>
                <div className="flex justify-between"><span className="font-bold text-orange-400">B3 (65-69)</span> <span>Good</span></div>
                <div className="flex justify-between"><span className="font-bold text-slate-300">E8 (40-44)</span> <span>Pass</span></div>
                <div className="flex justify-between"><span className="font-bold text-slate-300">C4 (60-64)</span> <span>Credit</span></div>
                <div className="flex justify-between"><span className="font-bold text-red-400">F9 (0-39)</span> <span>Fail</span></div>
                <div className="flex justify-between"><span className="font-bold text-slate-300">C5 (55-59)</span> <span>Credit</span></div>
              </div>
            </div>
          </div>

          {/* Comments & Promotion */}
          <div className="border-l-4 border-slate-900 pl-6 py-2">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Principal's Comment</h4>
            <p className="text-slate-700 italic font-medium leading-relaxed">
              "Emeka is an outstanding student who consistently demonstrates excellence in both academics and character. His performance in science subjects is particularly commendable. Keep up the brilliant work."
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <span className="font-bold text-green-800">Final Decision</span>
            <span className="text-lg font-black text-green-700 uppercase tracking-widest">Promoted to SS3B</span>
          </div>

          {/* Signatures */}
          <div className="pt-8 mt-4 grid grid-cols-2 gap-16 border-t border-slate-200">
            <div className="text-center">
              <div className="border-b-2 border-slate-300 h-12 mb-2 relative">
                {/* Simulated signature line */}
              </div>
              <p className="font-bold text-slate-900">Mr. Ojo Babatunde</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Class Teacher</p>
            </div>
            <div className="text-center">
              <div className="border-b-2 border-slate-300 h-12 mb-2 relative">
                {/* Simulated signature line */}
              </div>
              <p className="font-bold text-slate-900">Dr. (Mrs) Florence Okafor</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Principal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Print Button (hidden when printing) */}
      <div className="fixed bottom-8 right-8 print:hidden">
        <button 
          onClick={handlePrint}
          className="bg-slate-900 hover:bg-orange-500 text-white rounded-full p-4 shadow-xl transition-colors duration-300 flex items-center justify-center group"
          title="Print Report Card"
        >
          <Printer size={24} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
}
