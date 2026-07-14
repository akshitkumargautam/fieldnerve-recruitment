import { prisma } from '../../db/prismaClient';
import { AppError } from '../../shared/errors';

export class WorkRequirementService {
  async createWorkRequirement(data: any) {
    return prisma.workRequirement.create({ data });
  }

  async getWorkRequirements(filters: any) {
    return prisma.workRequirement.findMany({ where: filters });
  }

  async getWorkRequirementById(id: string) {
    const req = await prisma.workRequirement.findUnique({ where: { id } });
    if (!req) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);
    return req;
  }

  async updateWorkRequirement(id: string, data: any) {
    const req = await prisma.workRequirement.findUnique({ where: { id } });
    if (!req) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);
    
    return prisma.workRequirement.update({ where: { id }, data });
  }

  async assignVendor(id: string, vendorId: string) {
    const req = await prisma.workRequirement.findUnique({ where: { id } });
    if (!req) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);

    if (req.status !== 'OPEN') {
      throw new AppError('Work requirement is not OPEN', 'CONFLICT', 409);
    }

    // Must have a recommendation run with this vendor as eligible
    const latestRun = await prisma.recommendationRun.findFirst({
      where: { workRequirementId: id },
      orderBy: { generatedAt: 'desc' },
      include: { results: { where: { vendorId } } }
    });

    if (!latestRun) {
      throw new AppError('No recommendation run exists yet for this work requirement', 'CONFLICT', 409);
    }

    const vendorResult = latestRun.results[0];
    if (!vendorResult || !vendorResult.eligible) {
      throw new AppError('Vendor was not eligible in the latest recommendation run', 'CONFLICT', 409);
    }

    return prisma.workRequirement.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedVendorId: vendorId,
        assignedAt: new Date()
      }
    });
  }
}
