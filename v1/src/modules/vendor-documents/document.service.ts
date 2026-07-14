import { prisma } from '../../db/prismaClient';
import { AppError } from '../../shared/errors';

export class DocumentService {
  async createDocument(vendorId: string, data: any) {
    const existing = await prisma.vendorDocument.findUnique({
      where: { vendorId_documentType: { vendorId, documentType: data.documentType } }
    });
    if (existing) {
      throw new AppError('Document type already exists for this vendor', 'CONFLICT', 409);
    }
    return prisma.vendorDocument.create({
      data: { ...data, vendorId }
    });
  }

  async getDocuments(vendorId: string) {
    return prisma.vendorDocument.findMany({ where: { vendorId } });
  }

  async updateDocument(vendorId: string, docId: string, data: any) {
    const doc = await prisma.vendorDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.vendorId !== vendorId) {
      throw new AppError('Document not found', 'NOT_FOUND', 404);
    }
    return prisma.vendorDocument.update({ where: { id: docId }, data });
  }

  async deleteDocument(vendorId: string, docId: string) {
    const doc = await prisma.vendorDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.vendorId !== vendorId) {
      throw new AppError('Document not found', 'NOT_FOUND', 404);
    }
    await prisma.vendorDocument.delete({ where: { id: docId } });
  }
}
