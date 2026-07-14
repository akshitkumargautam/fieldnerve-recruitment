import { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { documentCreateSchema, documentUpdateSchema } from './document.validation';

const docService = new DocumentService();

export class DocumentController {
  async createDocument(req: Request, res: Response) {
    const { id: vendorId } = req.params;
    const data = documentCreateSchema.parse(req.body);
    const doc = await docService.createDocument(vendorId, data);
    res.status(201).json({ data: doc });
  }

  async getDocuments(req: Request, res: Response) {
    const { id: vendorId } = req.params;
    const docs = await docService.getDocuments(vendorId);
    res.status(200).json({ data: docs });
  }

  async updateDocument(req: Request, res: Response) {
    const { id: vendorId, docId } = req.params;
    const data = documentUpdateSchema.parse(req.body);
    const doc = await docService.updateDocument(vendorId, docId, data);
    res.status(200).json({ data: doc });
  }

  async deleteDocument(req: Request, res: Response) {
    const { id: vendorId, docId } = req.params;
    await docService.deleteDocument(vendorId, docId);
    res.status(204).send();
  }
}
