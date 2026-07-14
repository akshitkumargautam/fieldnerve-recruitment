import { Router } from 'express';
import { DocumentController } from './document.controller';
import { asyncHandler } from '../../shared/asyncHandler';

export const vendorDocumentRoutes = Router({ mergeParams: true });
const controller = new DocumentController();

vendorDocumentRoutes.post('/', asyncHandler(controller.createDocument.bind(controller)));
vendorDocumentRoutes.get('/', asyncHandler(controller.getDocuments.bind(controller)));
vendorDocumentRoutes.patch('/:docId', asyncHandler(controller.updateDocument.bind(controller)));
vendorDocumentRoutes.delete('/:docId', asyncHandler(controller.deleteDocument.bind(controller)));
