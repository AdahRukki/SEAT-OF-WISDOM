import { getRatingText } from "@shared/schema";

export interface ReportSubjectRow {
  name: string;
  firstCA: number;
  secondCA: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  classAverage?: number | null;
  position?: number | null;
}

export interface ReportCardParams {
  studentName: string;
  studentId: string;
  className: string;
  gender: string;
  ageDisplay: string;
  term: string;
  session: string;
  nextTermDate?: string | null;
  logoUrl?: string | null;
  subjects: ReportSubjectRow[];
  attendanceDays?: { total: number; present: number } | null;
  behavioralRating?: {
    attendancePunctuality?: number | null;
    neatnessOrganization?: number | null;
    respectPoliteness?: number | null;
    participationTeamwork?: number | null;
    responsibility?: number | null;
  } | null;
  principalComment: string;
  behavioralInterpretation?: string | null;
  promotionText?: string | null;
  principalSignatureUrl?: string | null;
}

export function positionSuffix(pos: number | null | undefined): string {
  if (!pos) return '—';
  if (pos % 100 >= 11 && pos % 100 <= 13) return pos + 'th';
  switch (pos % 10) {
    case 1: return pos + 'st';
    case 2: return pos + 'nd';
    case 3: return pos + 'rd';
    default: return pos + 'th';
  }
}

export function getPrincipalComment(avg: number): string {
  if (avg >= 90) return "Outstanding performance! You have demonstrated excellent understanding and consistency. Keep up this remarkable standard.";
  if (avg >= 80) return "A very good result! You are focused and hardworking. Maintain this level of commitment for even greater success.";
  if (avg >= 75) return "Good work! You show clear understanding of your subjects. With a bit more effort, you can reach the top.";
  if (avg >= 70) return "A fairly good performance. You are doing well, but there is still room for improvement. Aim higher next term.";
  if (avg >= 65) return "You have tried, but you can do much better. Put in more effort and stay focused on your studies.";
  if (avg >= 60) return "A fair attempt, but there is a need for greater dedication. Work harder to improve your overall performance.";
  if (avg >= 50) return "You passed, but this performance is not satisfactory. More seriousness and consistent study habits are required.";
  if (avg >= 45) return "You barely passed. Try to be more attentive in class and spend more time revising your work.";
  if (avg >= 40) return "A poor result. You need to put in significant effort and seek help from teachers to strengthen weak areas.";
  return "Very poor performance. You must work very hard and take your studies seriously. Consistent supervision is advised.";
}

export function getBehavioralInterpretationText(rating: {
  attendancePunctuality?: number | null;
  neatnessOrganization?: number | null;
  respectPoliteness?: number | null;
  participationTeamwork?: number | null;
  responsibility?: number | null;
} | null | undefined): string {
  if (!rating) return '';
  const vals = [
    rating.attendancePunctuality,
    rating.neatnessOrganization,
    rating.respectPoliteness,
    rating.participationTeamwork,
    rating.responsibility,
  ].map(v => (v != null ? v : 3));
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg >= 4.5) return 'Excellent Behavior';
  if (avg >= 3.5) return 'Very Good Behavior';
  if (avg >= 2.5) return 'Good Behavior';
  if (avg >= 1.5) return 'Fair Behavior - Needs Improvement';
  return 'Poor Behavior - Urgent Attention Required';
}

export function generateReportCardHtml(params: ReportCardParams): string {
  const {
    studentName, studentId, className, gender, ageDisplay,
    term, session, nextTermDate, logoUrl,
    subjects, attendanceDays, behavioralRating,
    principalComment, behavioralInterpretation, promotionText,
    principalSignatureUrl,
  } = params;

  const totalMarks = subjects.reduce((s, sub) => s + sub.total, 0);
  const averagePercentage = subjects.length ? (totalMarks / (subjects.length * 100)) * 100 : 0;
  const hasClassStats = subjects.some(s => s.classAverage != null || s.position != null);

  // Report HTML is written into a fresh window/print context where relative
  // URLs may not resolve — always use absolute URLs for images.
  const absUrl = (u: string | null | undefined) =>
    u && u.startsWith('/') ? `${window.location.origin}${u}` : (u || '');

  const nextTermDisplay = nextTermDate
    ? new Date(nextTermDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBA';

  const classStatsHeaders = hasClassStats ? `
    <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Class<br><span style="font-size:7px;font-weight:400;opacity:0.85">Avg</span></th>
    <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Subj.<br><span style="font-size:7px;font-weight:400;opacity:0.85">Pos.</span></th>
  ` : '';

  const subjectRows = subjects.map((sub, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f0f4ff';
    const classAvgCell = hasClassStats
      ? `<td style="text-align:center;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.classAverage != null ? sub.classAverage : '—'}</td>`
      : '';
    const posCell = hasClassStats
      ? `<td style="text-align:center;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${positionSuffix(sub.position)}</td>`
      : '';
    return `<tr>
      <td style="text-align:left;font-weight:600;color:#0f172a;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${String(sub.name || '').toUpperCase()}</td>
      <td style="text-align:center;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.firstCA}</td>
      <td style="text-align:center;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.secondCA}</td>
      <td style="text-align:center;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.exam}</td>
      <td style="text-align:center;font-weight:700;background:#e8eeff;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;">${sub.total}</td>
      ${classAvgCell}
      ${posCell}
      <td style="text-align:center;font-weight:700;color:#1e3a8a;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.grade}</td>
      <td style="text-align:center;font-style:italic;border:1px solid #1e3a8a;font-size:9px;padding:7px 6px;background:${bg};">${sub.remark}</td>
    </tr>`;
  }).join('');

  const attendanceSection = (attendanceDays && attendanceDays.total > 0) ? `
    <div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #1e3a8a;padding-bottom:5px;margin:14px 0 12px;">Attendance</div>
    <table style="width:100%;border-collapse:collapse;font-size:9px;">
      <tr>
        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#f0f4ff;font-weight:600;">Days School Opened</td>
        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#ffffff;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;">${attendanceDays.total}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#f0f4ff;font-weight:600;">Days Present</td>
        <td style="padding:6px 8px;border:1px solid #1e3a8a;background:#e8eeff;text-align:center;font-weight:700;color:#1e3a8a;font-variant-numeric:tabular-nums;">${attendanceDays.present}</td>
      </tr>
    </table>
  ` : '';

  const behavioralContent = behavioralRating ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid rgba(212,175,55,0.15);"><span>Attendance/Punctuality</span><span style="font-weight:700;">${getRatingText(behavioralRating.attendancePunctuality || 3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid rgba(212,175,55,0.15);"><span>Neatness/Organization</span><span style="font-weight:700;">${getRatingText(behavioralRating.neatnessOrganization || 3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid rgba(212,175,55,0.15);"><span>Respect/Politeness</span><span style="font-weight:700;">${getRatingText(behavioralRating.respectPoliteness || 3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid rgba(212,175,55,0.15);"><span>Participation/Teamwork</span><span style="font-weight:700;">${getRatingText(behavioralRating.participationTeamwork || 3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;"><span>Responsibility</span><span style="font-weight:700;">${getRatingText(behavioralRating.responsibility || 3)}</span></div>
    </div>
    ${behavioralInterpretation ? `<div style="text-align:center;margin-top:6px;font-size:9px;font-weight:700;color:#1e3a8a;">${behavioralInterpretation}</div>` : ''}
  ` : `<div style="font-size:9px;color:#64748b;font-style:italic;">No behavioral data recorded.</div>`;

  const signatureHtml = principalSignatureUrl
    ? `<div style="height:36px;margin-bottom:4px;display:flex;align-items:flex-end;justify-content:center;"><img src="${absUrl(principalSignatureUrl)}" alt="Principal Signature" style="max-height:36px;max-width:150px;" crossorigin="anonymous" /></div>`
    : `<div style="border-bottom:1px solid #1e3a8a;height:36px;margin-bottom:4px;"></div><div style="font-size:8px;color:#94a3b8;font-style:italic;text-align:center;">No signature uploaded</div>`;

  return `<!DOCTYPE html>
<html>
  <head>
    <title>Report Card - ${studentName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e8eeff; color: #1e3a8a; line-height: 1.4; }
      .report-card { width: 100%; max-width: 760px; margin: 20px auto; background: #fdfbf7; box-shadow: 0 4px 20px rgba(30,58,138,0.15); border: 1px solid #c7d2fe; }
      .print-button { display: block; width: 220px; margin: 16px auto 8px; padding: 11px 24px; background: #1e3a8a; color: white; border: none; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; }
      @media print {
        * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        body { background: white !important; margin: 0 !important; }
        .report-card { margin: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; }
        .print-button { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="report-card">

      <div style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);padding:28px 28px 22px 28px;display:flex;align-items:center;gap:20px;border-bottom:4px solid #d4af37;color:white;">
        <img src="${absUrl(logoUrl || '/assets/academy-logo.png')}" alt="School Logo" style="width:80px;height:80px;border-radius:50%;border:3px solid #d4af37;background:white;object-fit:cover;flex-shrink:0;" crossorigin="anonymous" />
        <div style="flex:1;text-align:center;">
          <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;letter-spacing:1px;margin-bottom:3px;">SEAT OF WISDOM ACADEMY</div>
          <div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d4af37;margin-bottom:3px;">Pre-Nursery, Nursery, Primary &amp; Secondary</div>
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bfdbfe;margin-bottom:4px;">Asaba, Delta State</div>
          <div style="font-family:'Playfair Display',serif;font-style:italic;color:#d4af37;font-size:11px;margin-bottom:10px;">&ldquo;The Fear of the Lord is the Beginning of Wisdom&rdquo;</div>
          <div style="display:inline-block;border-top:1px solid #d4af37;border-bottom:1px solid #d4af37;padding:5px 24px;">
            <div style="font-family:'Playfair Display',serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;">${term.toUpperCase()} Assessment Report &mdash; ${session} Session</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:16px 24px;background:#f0f4ff;border-bottom:2px solid #d4af37;">
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Student Name</span><span style="font-family:'Playfair Display',serif;font-size:12px;font-weight:600;color:#0f172a;">${studentName}</span></div>
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Student ID</span><span style="font-size:12px;font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums;">${studentId}</span></div>
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Class</span><span style="font-size:12px;font-weight:600;color:#0f172a;">${className}</span></div>
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Gender</span><span style="font-size:12px;font-weight:600;color:#0f172a;">${gender || 'N/A'}</span></div>
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Age</span><span style="font-size:12px;font-weight:600;color:#0f172a;">${ageDisplay}</span></div>
        <div><span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;display:block;margin-bottom:2px;">Next Term Begins</span><span style="font-size:12px;font-weight:600;color:#0f172a;">${nextTermDisplay}</span></div>
      </div>

      <div style="padding:20px 24px;">

        <div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #1e3a8a;padding-bottom:5px;margin-bottom:12px;">Academic Performance</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10px;">
          <thead>
            <tr>
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Subject</th>
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">1st CA<br><span style="font-size:7px;font-weight:400;opacity:0.85">(20)</span></th>
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">2nd CA<br><span style="font-size:7px;font-weight:400;opacity:0.85">(20)</span></th>
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Exam<br><span style="font-size:7px;font-weight:400;opacity:0.85">(60)</span></th>
              <th style="background:#1d4ed8;color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Total<br><span style="font-size:7px;font-weight:400;opacity:0.85">(100)</span></th>
              ${classStatsHeaders}
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Grade</th>
              <th style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;padding:8px 6px;text-align:center;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #1e3a8a;">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${subjectRows}
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #1e3a8a;padding-bottom:5px;margin-bottom:12px;">Summary</div>
            <div style="background:#f0f4ff;border:1px solid #c7d2fe;padding:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(212,175,55,0.2);font-size:10px;"><span>Total Score</span><span style="font-weight:700;color:#1e3a8a;font-variant-numeric:tabular-nums;">${totalMarks} / ${subjects.length * 100}</span></div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:10px;"><span>Average</span><span style="font-weight:700;color:#1e3a8a;">${averagePercentage.toFixed(1)}%</span></div>
            </div>
            ${attendanceSection}
          </div>
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #1e3a8a;padding-bottom:5px;margin-bottom:12px;">Behavioral Assessment</div>
            <div style="background:#f0f4ff;border:1px solid #c7d2fe;padding:12px;">
              ${behavioralContent}
            </div>
          </div>
        </div>

        <div style="border-left:4px solid #1e3a8a;padding:10px 14px;margin-bottom:16px;background:#f8faff;">
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:11px;color:#1e3a8a;margin-bottom:5px;">Principal's Comment</div>
          <p style="font-size:9px;font-style:italic;line-height:1.6;color:#1e3a8a;">${principalComment}</p>
        </div>

        ${promotionText ? `
        <div style="background:linear-gradient(to right,#1e3a8a,#1d4ed8,#1e3a8a);color:white;text-align:center;padding:12px;border:2px solid #d4af37;margin-bottom:20px;">
          <div style="font-family:'Inter',sans-serif;font-size:8px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;margin-bottom:4px;">Final Decision</div>
          <div style="font-family:'Inter',sans-serif;font-size:16px;font-weight:700;letter-spacing:1px;">${promotionText}</div>
        </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:end;margin-bottom:20px;">
          <div style="background:#f0f4ff;border:1px solid #c7d2fe;padding:10px 12px;">
            <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid rgba(212,175,55,0.4);padding-bottom:4px;margin-bottom:6px;">Grading Key (WAEC Standard)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:8px;font-weight:600;color:#1e3a8a;">
              <div><strong>A1</strong>: 75-100 Excellent</div><div><strong>C6</strong>: 50-54 Credit</div>
              <div><strong>B2</strong>: 70-74 Very Good</div><div><strong>D7</strong>: 45-49 Pass</div>
              <div><strong>B3</strong>: 65-69 Good</div><div><strong>E8</strong>: 40-44 Pass</div>
              <div><strong>C4</strong>: 60-64 Credit</div><div><strong>F9</strong>: 0-39 Fail</div>
              <div><strong>C5</strong>: 55-59 Credit</div>
            </div>
          </div>
          <div style="text-align:center;">
            ${signatureHtml}
            <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;">Principal</div>
          </div>
        </div>

      </div>
    </div>
    <button class="print-button" onclick="window.print()">Print Report Card</button>
  </body>
</html>`;
}
