import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { classes, students, users, paymentAuditLogs } from '../shared/schema';
import { hasPermission } from '../shared/permissions';
import { lockHistorySchools, StudentHistoryError } from './student-history';
export const batchDeactivationSchema = z.object({
  classId: z.string().min(1).max(50),
  studentIds: z.array(z.string().uuid()).min(1).max(500),
}).strict();
export async function deactivateStudents(database: any, actor: any, input: unknown) {
  const { classId, studentIds } = batchDeactivationSchema.parse(input);
  if (!hasPermission(actor.role, actor.permissions, 'tab_students')) throw new StudentHistoryError('Student management access required', 403);
  const ids = Array.from(new Set(studentIds)).sort();
  return database.transaction(async (tx: any) => {
    const [cls] = await tx.select().from(classes).where(eq(classes.id, classId));
    if (!cls || (actor.role !== 'admin' && (!actor.schoolId || actor.schoolId !== cls.schoolId))) throw new StudentHistoryError('This class is outside your school', 403);
    await lockHistorySchools(tx, [cls.schoolId]);
    const rows = await tx.select().from(students).where(inArray(students.id, ids)).orderBy(students.id).for('update');
    if (rows.length !== ids.length || rows.some((s: any) => s.classId !== classId)) throw new StudentHistoryError('Some selected students are no longer in this class. Refresh and select them again.', 409);
    const userIds = rows.map((s: any) => s.userId);
    const accounts = await tx.select().from(users).where(inArray(users.id, userIds)).orderBy(users.id).for('update');
    if (accounts.length !== ids.length || accounts.some((u: any) => u.role !== 'student')) throw new StudentHistoryError('Invalid student account selection');
    const activeIds = accounts.filter((u: any) => u.isActive !== false).map((u: any) => u.id);
    if (!activeIds.length) return { deactivatedCount: 0 };
    // Account deactivation preserves enrolment status, scores, payments and class history.
    await tx.update(users).set({ isActive: false, updatedAt: new Date() }).where(inArray(users.id, activeIds));
    await tx.insert(paymentAuditLogs).values({ action:'deactivate_students',entityType:'student',userId:actor.id,
      actorRole:actor.role, actorName:[actor.firstName,actor.middleName,actor.lastName].filter(Boolean).join(' '),schoolId:cls.schoolId,
      previousData:{classId,studentIds:rows.filter((s: any)=>activeIds.includes(s.userId)).map((s: any)=>s.id),isActive:true},
      newData:{isActive:false,deactivatedCount:activeIds.length} });
    return { deactivatedCount: activeIds.length };
  });
}
