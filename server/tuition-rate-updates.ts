import { z } from 'zod';
import { tuitionPeriodOrder } from '../shared/historical-tuition';

const money = z.union([z.number(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).transform(Number)
  .refine(value => Number.isFinite(value) && value >= 0 && value <= 99999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Enter a nonnegative amount with at most two decimal places');
const update = z.object({
  amounts: z.array(z.object({ classId: z.string().min(1).max(50),amount: money,studentType: z.enum(['new','returning']).nullable().optional() })).max(10000),
  term: z.enum(['First Term','Second Term','Third Term']).optional(),
  session: z.string().regex(/^\d{4}\/\d{4}$/).refine(value => Number(value.slice(5)) === Number(value.slice(0,4)) + 1).optional(),
  verifiedHistoricalRate: z.boolean().optional(), verificationReason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (!!value.term !== !!value.session) context.addIssue({ code:'custom',message:'Supply both term and session, or leave both empty for general rates.' });
  const keys = value.amounts.map(row => `${row.classId}:${row.studentType || ''}`);
  if (new Set(keys).size !== keys.length) context.addIssue({code:'custom',message:'Each class/student type must have one rate per period.'});
});

export function parseTuitionRateUpdate(input: unknown, current: { currentTerm: string | null; currentSession: string | null }) {
  const parsed = update.parse(input);
  const selected = tuitionPeriodOrder(parsed);
  const currentOrder = tuitionPeriodOrder({term:current.currentTerm,session:current.currentSession});
  const historical = selected !== null && (currentOrder === null || selected < currentOrder);
  if (historical
    && (parsed.verifiedHistoricalRate !== true || (parsed.verificationReason || '').length < 10)) {
    throw new Error('Confirm the historical rate against school records and provide a verification reason of at least 10 characters.');
  }
  return { ...parsed, historical, amounts: parsed.amounts.map(row => ({ ...row,amount:row.amount.toFixed(2),studentType:row.studentType ?? null })) };
}
