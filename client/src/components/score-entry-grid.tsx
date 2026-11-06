import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatStudentName } from "@shared/student-name";

/** Shared score grid: used by the administrator Scores tab and teacher score entry. */
export function ScoreEntryGrid({ filteredStudents, classAssessments, scoreInputs, handleScoreChange, handleKeyDown, calculateGrade, onDelete, deleting = false }: {
 filteredStudents: any[];
 classAssessments: any[];
 scoreInputs: Record<string, {firstCA?: string; secondCA?: string; exam?: string}>;
 handleScoreChange: (studentId: string, field: string, value: string) => void;
 handleKeyDown: (event: any, studentId: string, field: string) => void;
 calculateGrade: (total: number) => {grade: string};
 onDelete?: (id: string) => void;
 deleting?: boolean;
}) {
 const fieldHasScore = (typed: string | undefined, saved: number | null | undefined) => typed !== undefined ? typed !== "" : saved !== null && saved !== undefined;
 return <>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/60 border-b border-border">
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-foreground w-[35%]">Student</th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell">ID</th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  CA1<span className="font-normal text-muted-foreground">/20</span>
                                </th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                  CA2<span className="font-normal text-muted-foreground">/20</span>
                                </th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-purple-600 dark:text-purple-400">
                                  Exam<span className="font-normal text-muted-foreground">/60</span>
                                </th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-foreground">Total</th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-foreground">Grade</th>
                                <th className="px-1 py-2.5 text-center text-xs font-semibold text-muted-foreground w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredStudents.map((student, idx) => {
                                const assessment = classAssessments.find(a => a.studentId === student.id);
                                const currentScores = scoreInputs[student.id] || {};
                                const firstCA = Number(currentScores.firstCA ?? assessment?.firstCA ?? 0);
                                const secondCA = Number(currentScores.secondCA ?? assessment?.secondCA ?? 0);
                                const exam = Number(currentScores.exam ?? assessment?.exam ?? 0);
                                const total = firstCA + secondCA + exam;
                                const { grade } = calculateGrade(total);
                                const hasDirtyInput = !!(currentScores.firstCA !== undefined || currentScores.secondCA !== undefined || currentScores.exam !== undefined);
                                const hasAnyScore = fieldHasScore(currentScores.firstCA, assessment?.firstCA) || fieldHasScore(currentScores.secondCA, assessment?.secondCA) || fieldHasScore(currentScores.exam, assessment?.exam);
                                const gradeColors: Record<string, string> = {
                                  A: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
                                  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                                  C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
                                  D: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
                                  F: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
                                };
                                return (
                                  <tr key={student.id} className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-primary/5 transition-colors ${hasDirtyInput ? 'border-l-2 border-l-amber-400' : ''}`}>
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-sm text-foreground leading-tight flex items-center gap-1.5">
                                        <span>{formatStudentName(student.user)}</span>
                                        {student.user?.isActive === false && (
                                          <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1 rounded shrink-0 font-medium">Inactive</span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground sm:hidden">{student.studentId}</div>
                                    </td>
                                    <td className="px-2 py-2 text-center text-xs text-muted-foreground hidden sm:table-cell">{student.studentId}</td>
                                    <td className="px-1.5 py-2 text-center">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="20"
                                        className="w-14 h-8 text-center text-sm px-1 border-blue-200 focus:border-blue-400 dark:border-blue-800"
                                        value={currentScores.firstCA ?? assessment?.firstCA ?? ''}
                                        onChange={(e) => handleScoreChange(student.id, 'firstCA', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, student.id, 'firstCA')}
                                        data-student-id={student.id}
                                        data-field="firstCA"
                                        placeholder="—"
                                        tabIndex={0}
                                      />
                                    </td>
                                    <td className="px-1.5 py-2 text-center">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="20"
                                        className="w-14 h-8 text-center text-sm px-1 border-indigo-200 focus:border-indigo-400 dark:border-indigo-800"
                                        value={currentScores.secondCA ?? assessment?.secondCA ?? ''}
                                        onChange={(e) => handleScoreChange(student.id, 'secondCA', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, student.id, 'secondCA')}
                                        data-student-id={student.id}
                                        data-field="secondCA"
                                        placeholder="—"
                                        tabIndex={0}
                                      />
                                    </td>
                                    <td className="px-1.5 py-2 text-center">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="60"
                                        className="w-14 h-8 text-center text-sm px-1 border-purple-200 focus:border-purple-400 dark:border-purple-800"
                                        value={currentScores.exam ?? assessment?.exam ?? ''}
                                        onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, student.id, 'exam')}
                                        data-student-id={student.id}
                                        data-field="exam"
                                        placeholder="—"
                                        tabIndex={0}
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <span className={`text-sm font-bold ${total >= 70 ? 'text-green-600' : total >= 50 ? 'text-blue-600' : total > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                        {hasAnyScore ? total : '—'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {hasAnyScore && (
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${gradeColors[grade[0]] || gradeColors.F}`}>
                                          {grade}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-1 py-2 text-center">
                                      {assessment && onDelete && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                          onClick={() => {
                                            if (window.confirm(`Delete score for ${formatStudentName(student.user)}?`)) {
                                              onDelete?.(assessment.id);
                                            }
                                          }}
                                          disabled={deleting}
                                          title="Delete score"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>


 </>;
}
