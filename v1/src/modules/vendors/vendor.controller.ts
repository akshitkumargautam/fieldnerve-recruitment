import { Request, Response } from 'express';
import { VendorService } from './vendor.service';
import { vendorCreateSchema, vendorUpdateSchema } from './vendor.validation';

const vendorService = new VendorService();

export class VendorController {
  async createVendor(req: Request, res: Response) {
    const data = vendorCreateSchema.parse(req.body);
    const vendor = await vendorService.createVendor(data);
    res.status(201).json({ data: vendor });
  }

  async getVendors(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.vendorType) filters.vendorType = req.query.vendorType;
    if (req.query.currentStatus) filters.currentStatus = req.query.currentStatus;
    if (req.query.operatingLocation) filters.operatingLocation = req.query.operatingLocation;

    const vendors = await vendorService.getVendors(filters);
    res.status(200).json({ data: vendors });
  }

  async getVendorById(req: Request, res: Response) {
    const vendor = await vendorService.getVendorById(req.params.id);
    res.status(200).json({ data: vendor });
  }

  async updateVendor(req: Request, res: Response) {
    const data = vendorUpdateSchema.parse(req.body);
    const vendor = await vendorService.updateVendor(req.params.id, data);
    res.status(200).json({ data: vendor });
  }

  async deleteVendor(req: Request, res: Response) {
    await vendorService.deleteVendor(req.params.id);
    res.status(204).send();
  }
}
