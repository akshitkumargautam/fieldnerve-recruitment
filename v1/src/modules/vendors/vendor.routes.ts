import { Router } from 'express';
import { VendorController } from './vendor.controller';
import { asyncHandler } from '../../shared/asyncHandler';

export const vendorRoutes = Router();
const controller = new VendorController();

vendorRoutes.post('/', asyncHandler(controller.createVendor.bind(controller)));
vendorRoutes.get('/', asyncHandler(controller.getVendors.bind(controller)));
vendorRoutes.get('/:id', asyncHandler(controller.getVendorById.bind(controller)));
vendorRoutes.patch('/:id', asyncHandler(controller.updateVendor.bind(controller)));
vendorRoutes.delete('/:id', asyncHandler(controller.deleteVendor.bind(controller)));
