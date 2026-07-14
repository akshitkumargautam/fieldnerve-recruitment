import { prisma } from '../../db/prismaClient';
import { AppError } from '../../shared/errors';

export class VendorService {
  async createVendor(data: any) {
    return prisma.vendor.create({ data });
  }

  async getVendors(filters: any) {
    return prisma.vendor.findMany({ where: filters });
  }

  async getVendorById(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { documents: true }
    });
    if (!vendor) throw new AppError('Vendor not found', 'NOT_FOUND', 404);
    return vendor;
  }

  async updateVendor(id: string, data: any) {
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new AppError('Vendor not found', 'NOT_FOUND', 404);
    
    return prisma.vendor.update({ where: { id }, data });
  }

  async deleteVendor(id: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new AppError('Vendor not found', 'NOT_FOUND', 404);
    
    await prisma.vendor.delete({ where: { id } });
  }
}
