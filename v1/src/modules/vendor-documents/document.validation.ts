import { z } from 'zod';

export const documentCreateSchema = z.object({
  documentType: z.enum(['TAX_REGISTRATION', 'INSURANCE', 'TRADE_LICENSE', 'SAFETY_CERTIFICATE', 'AGREEMENT']),
  documentNumber: z.string().min(1),
  issuedDate: z.string().optional().transform(val => val ? new Date(val) : null),
  expiryDate: z.string().optional().transform(val => val ? new Date(val) : null),
  status: z.enum(['VALID', 'EXPIRED', 'PENDING_VERIFICATION']),
});

export const documentUpdateSchema = z.object({
  documentNumber: z.string().min(1).optional(),
  issuedDate: z.string().optional().transform(val => val ? new Date(val) : null),
  expiryDate: z.string().optional().transform(val => val ? new Date(val) : null),
  status: z.enum(['VALID', 'EXPIRED', 'PENDING_VERIFICATION']).optional(),
});
