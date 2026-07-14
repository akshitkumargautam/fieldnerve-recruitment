import { z } from 'zod';

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  vendorType: z.enum(['CONTRACTOR', 'SUBCONTRACTOR', 'EQUIPMENT_RENTAL', 'MATERIAL_SUPPLIER', 'INSPECTION_AGENCY', 'CONSULTANT']),
  category: z.enum(['CIVIL_CONSTRUCTION', 'ELECTRICAL_INSTRUMENTATION', 'MECHANICAL_FABRICATION', 'LOGISTICS_EQUIPMENT', 'HSE_COMPLIANCE_TESTING']),
  contactPerson: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  operatingLocation: z.string().min(1),
  rating: z.number().min(0).max(5),
  safetyRating: z.number().min(0).max(5),
  currentStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED']).optional(),
});

export const vendorUpdateSchema = vendorCreateSchema.partial();
