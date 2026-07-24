import React from 'react';

export function Elegant() {
  const subjects = [
    { name: "Mathematics", ca1: 18, ca2: 19, exam: 58, total: 95, grade: "A1", remark: "Excellent" },
    { name: "English Language", ca1: 16, ca2: 18, exam: 52, total: 86, grade: "A1", remark: "Excellent" },
    { name: "Basic Science", ca1: 15, ca2: 17, exam: 48, total: 80, grade: "A1", remark: "Excellent" },
    { name: "Social Studies", ca1: 14, ca2: 15, exam: 45, total: 74, grade: "B2", remark: "Very Good" },
    { name: "Civic Education", ca1: 17, ca2: 16, exam: 50, total: 83, grade: "A1", remark: "Excellent" },
    { name: "Quantitative Reasoning", ca1: 19, ca2: 20, exam: 55, total: 94, grade: "A1", remark: "Excellent" },
    { name: "Verbal Reasoning", ca1: 16, ca2: 15, exam: 46, total: 77, grade: "A1", remark: "Excellent" },
    { name: "Computer Studies", ca1: 18, ca2: 17, exam: 54, total: 89, grade: "A1", remark: "Excellent" },
  ];

  const behavior = [
    { trait: "Attendance", rating: "5/5" },
    { trait: "Punctuality", rating: "5/5" },
    { trait: "Neatness", rating: "4/5" },
    { trait: "Respect", rating: "5/5" },
    { trait: "Participation", rating: "4/5" },
    { trait: "Responsibility", rating: "5/5" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600&display=swap');
        
        .elegant-container {
          background-color: #fdfbf7;
          color: #1a3c28;
          font-family: 'Inter', sans-serif;
        }
        
        .font-playfair {
          font-family: 'Playfair Display', serif;
        }
        
        .elegant-border {
          border-color: #d4af37;
        }
        
        .elegant-table-border {
          border-color: #2b5329;
        }
        
        .print-btn {
          background-color: #1a3c28;
          color: #fdfbf7;
        }
        .print-btn:hover {
          background-color: #2b5329;
        }
        
        @media print {
          .no-print {
            display: none;
          }
          .elegant-container {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
      
      <div className="elegant-container min-h-screen py-8 px-4 flex justify-center items-start overflow-y-auto">
        <div className="w-full max-w-[800px] bg-[#fdfbf7] shadow-xl border border-[#e8dfc8] relative pb-12">
          
          {/* Header */}
          <header className="text-white p-8 text-center border-b-4 border-[#d4af37] relative" style={{ background: 'linear-gradient(to right, #1e3a8a, #1d4ed8, #1e3a8a)' }}>
            <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-[#d4af37]">
              <span className="text-blue-900 font-playfair font-bold text-sm text-center leading-tight">SOWA<br/>LOGO</span>
            </div>
            
            <div className="ml-24">
              <h1 className="font-playfair text-4xl font-bold tracking-wider mb-1">SEAT OF WISDOM ACADEMY</h1>
              <p className="text-[#d4af37] text-xs font-semibold tracking-[0.25em] uppercase mb-1">PRE-NURSERY, NURSERY, PRIMARY &amp; SECONDARY</p>
              <p className="text-sm tracking-widest uppercase text-blue-200 mb-1">Asaba, Delta State</p>
              <p className="font-playfair italic text-[#d4af37] mb-4">"The Fear of the Lord is the Beginning of Wisdom"</p>
              
              <div className="inline-block border-t border-b border-[#d4af37] py-2 px-8 mt-2">
                <h2 className="font-playfair text-xl tracking-[0.2em] uppercase">Academic Report Card</h2>
              </div>
            </div>
          </header>

          <div className="px-10 py-8">
            {/* Student Info */}
            <section className="mb-8 p-6 bg-[#f7f3e8] border border-[#d4af37] rounded-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Student Name</span>
                  <span className="font-playfair text-lg font-semibold">Fatima Aisha Mohammed</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Student ID</span>
                  <span className="font-medium">SOWA/2021/0442</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Class</span>
                  <span className="font-medium">Primary 6</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Gender</span>
                  <span className="font-medium">Female</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Age</span>
                  <span className="font-medium">11 Years</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#2b5329] font-semibold mb-1">Next Term Begins</span>
                  <span className="font-medium">9th Sept, 2024</span>
                </div>
              </div>
            </section>

            {/* Academic Performance */}
            <section className="mb-8">
              <h3 className="font-playfair text-xl font-bold text-[#1a3c28] border-b-2 border-[#1a3c28] pb-2 mb-4 uppercase tracking-widest">Academic Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1a3c28] text-[#fdfbf7]">
                      <th className="py-3 px-4 text-left font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">Subject</th>
                      <th className="py-3 px-2 text-center font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">1st CA<br/><span className="text-[10px] font-normal opacity-80">(20)</span></th>
                      <th className="py-3 px-2 text-center font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">2nd CA<br/><span className="text-[10px] font-normal opacity-80">(20)</span></th>
                      <th className="py-3 px-2 text-center font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">Exam<br/><span className="text-[10px] font-normal opacity-80">(60)</span></th>
                      <th className="py-3 px-2 text-center font-semibold uppercase tracking-wider text-xs border border-[#1a3c28] bg-[#2b5329]">Total<br/><span className="text-[10px] font-normal opacity-80">(100)</span></th>
                      <th className="py-3 px-2 text-center font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">Grade</th>
                      <th className="py-3 px-4 text-left font-semibold uppercase tracking-wider text-xs border border-[#1a3c28]">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((sub, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fdfbf7]'}>
                        <td className="py-2 px-4 border border-[#2b5329] font-medium">{sub.name}</td>
                        <td className="py-2 px-2 border border-[#2b5329] text-center">{sub.ca1}</td>
                        <td className="py-2 px-2 border border-[#2b5329] text-center">{sub.ca2}</td>
                        <td className="py-2 px-2 border border-[#2b5329] text-center">{sub.exam}</td>
                        <td className="py-2 px-2 border border-[#2b5329] text-center font-bold bg-[#f7f3e8]">{sub.total}</td>
                        <td className="py-2 px-2 border border-[#2b5329] text-center font-bold text-[#1a3c28]">{sub.grade}</td>
                        <td className="py-2 px-4 border border-[#2b5329] italic text-sm">{sub.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Summary Stats */}
              <div>
                <h3 className="font-playfair text-lg font-bold text-[#1a3c28] border-b border-[#1a3c28] pb-1 mb-3 uppercase tracking-widest">Summary</h3>
                <div className="bg-[#f7f3e8] p-4 rounded-sm border border-[#e8dfc8]">
                  <div className="flex justify-between items-center py-2 border-b border-[#d4af37]/30">
                    <span className="text-sm font-medium">Total Score</span>
                    <span className="font-bold text-[#1a3c28]">678 / 800</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#d4af37]/30">
                    <span className="text-sm font-medium">Average</span>
                    <span className="font-bold text-[#1a3c28]">84.75%</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium">Attendance</span>
                    <span className="font-bold text-[#1a3c28]">98%</span>
                  </div>
                </div>
              </div>

              {/* Behavioral Assessment */}
              <div>
                <h3 className="font-playfair text-lg font-bold text-[#1a3c28] border-b border-[#1a3c28] pb-1 mb-3 uppercase tracking-widest">Behavioral</h3>
                <div className="bg-[#f7f3e8] p-4 rounded-sm border border-[#e8dfc8]">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                    {behavior.map((b, idx) => (
                      <div key={idx} className="flex justify-between border-b border-[#d4af37]/20 pb-1">
                        <span>{b.trait}</span>
                        <span className="font-bold">{b.rating}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks & Promotion */}
            <section className="mb-8">
              <div className="border-l-4 border-[#1a3c28] pl-4 mb-6">
                <h4 className="font-playfair font-bold text-[#1a3c28] mb-1">Principal's Comment</h4>
                <p className="text-sm italic leading-relaxed">"Fatima has shown exceptional dedication to her studies this term. Her outstanding performance across all subjects, particularly in Quantitative Reasoning, is highly commendable. She is a bright, well-mannered student who continues to be an asset to her class. Keep up the excellent work!"</p>
              </div>

              <div className="bg-[#1a3c28] text-[#fdfbf7] p-4 text-center border-2 border-[#d4af37]">
                <span className="block text-xs uppercase tracking-widest mb-1 opacity-80">Final Decision</span>
                <span className="font-playfair text-xl font-bold tracking-wide">PROMOTED TO JSS1</span>
              </div>
            </section>

            {/* WAEC Key & Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end mt-12 text-xs">
              <div className="bg-[#f7f3e8] p-3 border border-[#e8dfc8] rounded-sm">
                <h5 className="font-bold mb-2 uppercase tracking-wider text-[#1a3c28] border-b border-[#d4af37]/50 pb-1">Grading Key</h5>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div><span className="font-semibold">A1</span>: 75-100 (Excellent)</div>
                  <div><span className="font-semibold">C6</span>: 50-54 (Credit)</div>
                  <div><span className="font-semibold">B2</span>: 70-74 (Very Good)</div>
                  <div><span className="font-semibold">D7</span>: 45-49 (Pass)</div>
                  <div><span className="font-semibold">B3</span>: 65-69 (Good)</div>
                  <div><span className="font-semibold">E8</span>: 40-44 (Pass)</div>
                  <div><span className="font-semibold">C4</span>: 60-64 (Credit)</div>
                  <div><span className="font-semibold">F9</span>: 0-39 (Fail)</div>
                  <div><span className="font-semibold">C5</span>: 55-59 (Credit)</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-center pt-8">
                <div>
                  <div className="border-b border-[#1a3c28] mb-2 h-8 relative">
                    <img src="/principal-signature.png" alt="Signature" className="h-12 absolute bottom-0 left-1/2 -translate-x-1/2 opacity-80 mix-blend-multiply" onError={(e) => e.currentTarget.style.display = 'none'} />
                  </div>
                  <span className="uppercase tracking-widest text-[10px] font-bold text-[#1a3c28]">Class Teacher</span>
                </div>
                <div>
                  <div className="border-b border-[#1a3c28] mb-2 h-8 relative">
                     <img src="/principal-signature.png" alt="Signature" className="h-12 absolute bottom-0 left-1/2 -translate-x-1/2 opacity-80 mix-blend-multiply" onError={(e) => e.currentTarget.style.display = 'none'} />
                  </div>
                  <span className="uppercase tracking-widest text-[10px] font-bold text-[#1a3c28]">Principal</span>
                </div>
              </div>
            </div>

            {/* Print Button */}
            <div className="mt-12 text-center no-print">
              <button 
                onClick={() => window.print()}
                className="print-btn px-8 py-3 rounded-full font-semibold uppercase tracking-wider text-sm shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2 focus:ring-offset-[#fdfbf7]"
              >
                Print Report Card
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
