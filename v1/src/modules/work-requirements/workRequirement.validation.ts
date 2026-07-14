import { z } from 'zod';

export const workRequirementCreateSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['CIVIL_CONSTRUCTION', 'ELECTRICAL_INSTRUMENTATION', 'MECHANICAL_FABRICATION', 'LOGISTICS_EQUIPMENT', 'HSE_COMPLIANCE_TESTING']),
  location: z.string().min(1),
  estimatedValue: z.number().positive(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  expectedStartDate: z.string().transform(val => new Date(val)),
});

export const workRequirementUpdateSchema = workRequirementCreateSchema.partial();

export const workRequirementAssignSchema = z.object({
  vendorId: z.string().uuid()
});
