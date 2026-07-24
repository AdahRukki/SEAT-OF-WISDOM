import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Classic() {
  const subjects = [
    { name: "Mathematics", ca1: 18, ca2: 17, exam: 55, total: 90, grade: "A1", remark: "Excellent" },
    { name: "English Language", ca1: 15, ca2: 16, exam: 48, total: 79, grade: "A1", remark: "Excellent" },
    { name: "Basic Science", ca1: 16, ca2: 18, exam: 52, total: 86, grade: "A1", remark: "Excellent" },
    { name: "Social Studies", ca1: 14, ca2: 15, exam: 42, total: 71, grade: "B2", remark: "Very Good" },
    { name: "Civic Education", ca1: 19, ca2: 18, exam: 50, total: 87, grade: "A1", remark: "Excellent" },
    { name: "Agricultural Science", ca1: 16, ca2: 14, exam: 45, total: 75, grade: "A1", remark: "Excellent" },
    { name: "Business Studies", ca1: 13, ca2: 14, exam: 40, total: 67, grade: "B3", remark: "Good" },
    { name: "Christian Religious Studies", ca1: 17, ca2: 16, exam: 58, total: 91, grade: "A1", remark: "Excellent" },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col items-center overflow-y-auto">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        
        @media print {
          body {
            background-color: white;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .report-container {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      `}} />

      {/* Action Bar */}
      <div className="w-full max-w-4xl flex justify-end mb-4 no-print">
        <Button onClick={handlePrint} className="bg-blue-800 hover:bg-blue-900 text-white flex items-center gap-2 rounded-none border border-amber-500 shadow-sm">
          <Printer size={16} />
          Print Report Card
        </Button>
      </div>

      {/* Main A4 Container */}
      <div 
        className="report-container bg-white w-full max-w-[210mm] shadow-2xl relative"
        style={{ 
          fontFamily: "'Inter', sans-serif",
          border: "4px double #d4af37", 
          minHeight: "297mm",
        }}
      >
        <div className="border border-[#1e3a8a] m-1 absolute inset-0 pointer-events-none"></div>
        <div className="p-8 pb-12 relative z-10 flex flex-col gap-6">
          
          {/* Header */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 p-6 shadow-md border-b-4 border-amber-500 rounded-sm">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-amber-500 shadow-inner flex-shrink-0">
              <span className="font-bold text-blue-900 text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>SOWA</span>
            </div>
            
            <div className="flex-1 text-center px-4">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-wider uppercase mb-1 drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                Seat of Wisdom Academy
              </h1>
              <p className="text-amber-400 font-semibold text-sm md:text-base uppercase tracking-widest mb-1">
                Asaba, Delta State
              </p>
              <p className="text-blue-100 italic text-xs md:text-sm mb-3 font-serif">
                "The Fear of the Lord is the Beginning of Wisdom"
              </p>
              <div className="inline-block bg-white text-blue-900 px-6 py-1 rounded border border-amber-500 shadow font-bold tracking-widest uppercase text-sm">
                Terminal Report Card
              </div>
            </div>
            
            <div className="w-24 flex-shrink-0"></div> {/* Spacer for balance */}
          </div>

          {/* Student Info Bar */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-sm shadow-sm relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Student Name</span>
                <span className="font-bold text-blue-900 uppercase">Chioma Blessing Okonkwo</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Student ID</span>
                <span className="font-semibold text-gray-800">SOWA/2023/1042</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Class</span>
                <span className="font-bold text-blue-900">JSS1 A</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Gender</span>
                <span className="font-semibold text-gray-800">Female</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Age</span>
                <span className="font-semibold text-gray-800">11 Years</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase text-xs font-semibold block mb-0.5">Next Term Begins</span>
                <span className="font-semibold text-gray-800">9th September 2024</span>
              </div>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="overflow-x-auto rounded-sm border border-blue-800 shadow-sm mt-2">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-blue-900 text-white font-semibold text-xs uppercase" style={{ fontFamily: "'Playfair Display', serif" }}>
                <tr>
                  <th className="px-4 py-3 border-r border-blue-800 w-1/3">Subject</th>
                  <th className="px-2 py-3 border-r border-blue-800 text-center w-12">1st CA<br/><span className="text-[10px] text-blue-300 font-normal">(20)</span></th>
                  <th className="px-2 py-3 border-r border-blue-800 text-center w-12">2nd CA<br/><span className="text-[10px] text-blue-300 font-normal">(20)</span></th>
                  <th className="px-2 py-3 border-r border-blue-800 text-center w-12">Exam<br/><span className="text-[10px] text-blue-300 font-normal">(60)</span></th>
                  <th className="px-2 py-3 border-r border-blue-800 text-center w-12">Total<br/><span className="text-[10px] text-blue-300 font-normal">(100)</span></th>
                  <th className="px-2 py-3 border-r border-blue-800 text-center w-12">Grade</th>
                  <th className="px-4 py-3 text-center">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200">
                {subjects.map((sub, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                    <td className="px-4 py-2 border-r border-blue-200 font-medium text-gray-800">{sub.name}</td>
                    <td className="px-2 py-2 border-r border-blue-200 text-center">{sub.ca1}</td>
                    <td className="px-2 py-2 border-r border-blue-200 text-center">{sub.ca2}</td>
                    <td className="px-2 py-2 border-r border-blue-200 text-center">{sub.exam}</td>
                    <td className="px-2 py-2 border-r border-blue-200 text-center font-bold text-blue-900 bg-blue-100/50">{sub.total}</td>
                    <td className="px-2 py-2 border-r border-blue-200 text-center font-bold text-red-700">{sub.grade}</td>
                    <td className="px-4 py-2 text-center text-xs uppercase font-medium">{sub.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Stats & Behavior */}
            <div className="flex flex-col gap-6">
              
              <div className="border border-amber-500 rounded-sm p-4 bg-white relative">
                <h3 className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-blue-900 uppercase tracking-widest" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Summary Statistics
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div className="bg-blue-50 p-2 rounded border border-blue-100">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Total Score</span>
                    <span className="block text-xl font-black text-blue-900">646</span>
                  </div>
                  <div className="bg-amber-50 p-2 rounded border border-amber-100">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Average</span>
                    <span className="block text-xl font-black text-amber-600">80.8%</span>
                  </div>
                  <div className="bg-blue-50 p-2 rounded border border-blue-100">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Attendance</span>
                    <span className="block text-xl font-black text-blue-900">98%</span>
                  </div>
                </div>
              </div>

              <div className="border border-blue-800 rounded-sm overflow-hidden bg-white">
                <h3 className="bg-blue-800 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Behavioral Assessment
                </h3>
                <div className="p-3">
                  <table className="w-full text-xs">
                    <tbody>
                      <tr><td className="py-1 border-b border-gray-100">Attendance/Punctuality</td><td className="py-1 border-b border-gray-100 font-bold text-right text-blue-900">5/5</td></tr>
                      <tr><td className="py-1 border-b border-gray-100">Neatness</td><td className="py-1 border-b border-gray-100 font-bold text-right text-blue-900">5/5</td></tr>
                      <tr><td className="py-1 border-b border-gray-100">Respect</td><td className="py-1 border-b border-gray-100 font-bold text-right text-blue-900">4/5</td></tr>
                      <tr><td className="py-1 border-b border-gray-100">Participation</td><td className="py-1 border-b border-gray-100 font-bold text-right text-blue-900">4/5</td></tr>
                      <tr><td className="py-1">Responsibility</td><td className="py-1 font-bold text-right text-blue-900">5/5</td></tr>
                    </tbody>
                  </table>
                  <div className="text-[9px] text-gray-400 mt-2 text-center border-t border-gray-100 pt-1">
                    Rating Scale: 5 (Excellent) - 1 (Poor)
                  </div>
                </div>
              </div>
            </div>

            {/* Comments & Grading */}
            <div className="flex flex-col gap-6">
              
              <div className="border border-blue-800 rounded-sm bg-white p-4 h-full relative">
                <h3 className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-blue-900 uppercase tracking-widest" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Principal's Report
                </h3>
                
                <div className="mt-3 text-sm text-gray-700 italic leading-relaxed border-l-2 border-blue-200 pl-3">
                  "Chioma has shown exceptional dedication to her studies this term. Her performance across all core subjects is outstanding, particularly in Mathematics and Christian Religious Studies. She is a disciplined student with excellent leadership potential. Keep up the brilliant work!"
                </div>
                
                <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded text-center">
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Final Status</div>
                  <div className="text-lg font-black text-green-700 uppercase" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Promoted to JSS2
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded-sm bg-gray-50 p-3">
                <h3 className="text-xs font-bold text-gray-600 uppercase mb-2 text-center border-b border-gray-200 pb-1">
                  WAEC Grading Key
                </h3>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[9px] font-mono">
                  <div><span className="font-bold">A1</span>: 75-100 (Excellent)</div>
                  <div><span className="font-bold">B2</span>: 70-74 (Very Good)</div>
                  <div><span className="font-bold">B3</span>: 65-69 (Good)</div>
                  <div><span className="font-bold">C4</span>: 60-64 (Credit)</div>
                  <div><span className="font-bold">C5</span>: 55-59 (Credit)</div>
                  <div><span className="font-bold">C6</span>: 50-54 (Credit)</div>
                  <div><span className="font-bold">D7</span>: 45-49 (Pass)</div>
                  <div><span className="font-bold">E8</span>: 40-44 (Pass)</div>
                  <div><span className="font-bold text-red-600">F9</span>: 0-39 (Fail)</div>
                </div>
              </div>
              
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-8 pt-8 border-t-2 border-blue-100 flex justify-between px-8">
            <div className="text-center w-40">
              <div className="h-8 border-b border-black mb-2"></div>
              <p className="text-xs font-bold text-gray-800 uppercase">Class Teacher</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-2 border-blue-800 flex items-center justify-center opacity-20 transform -rotate-12 mx-auto -mt-6">
                <span className="text-[8px] font-bold text-blue-800 text-center leading-tight">OFFICIAL<br/>STAMP</span>
              </div>
            </div>

            <div className="text-center w-40">
              <div className="h-8 border-b border-black mb-2 flex items-end justify-center">
                <span className="font-signature text-blue-900 text-xl italic" style={{ fontFamily: "'Playfair Display', serif" }}>Dr. E. O.</span>
              </div>
              <p className="text-xs font-bold text-gray-800 uppercase">Principal</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
