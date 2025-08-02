import { z } from "zod";

export const insertStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  class: z.string().min(1, "Class is required"),
  scores: z.array(z.number().min(0).max(100)).default([]),
});

export const updateStudentSchema = insertStudentSchema.partial().extend({
  id: z.string(),
});

export const addScoreSchema = z.object({
  studentId: z.string(),
  score: z.number().min(0).max(100),
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type UpdateStudent = z.infer<typeof updateStudentSchema>;
export type AddScore = z.infer<typeof addScoreSchema>;

export interface Student extends InsertStudent {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
