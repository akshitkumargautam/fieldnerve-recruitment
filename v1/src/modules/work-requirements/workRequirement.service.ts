import { prisma } from '../../db/prismaClient';
import { AppError } from '../../shared/errors';

const assignedVendorInclude = { assignedVendor: { select: { name: true } } } as const;

// Responses expose a flat assignedVendorName next to assignedVendorId so
// consumers never need a second lookup to display who was assigned.
function toDto(req: any) {
  const { assignedVendor, ...rest } = req;
  return { ...rest, assignedVendorName: assignedVendor?.name ?? null };
}

export class WorkRequirementService {
  async createWorkRequirement(data: any) {
    const req = await prisma.workRequirement.create({ data, include: assignedVendorInclude });
    return toDto(req);
  }

  async getWorkRequirements(filters: any) {
    const reqs = await prisma.workRequirement.findMany({ where: filters, include: assignedVendorInclude });
    return reqs.map(toDto);
  }

  async getWorkRequirementById(id: string) {
    const req = await prisma.workRequirement.findUnique({ where: { id }, include: assignedVendorInclude });
    if (!req) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);
    return toDto(req);
  }

  async updateWorkRequirement(id: string, data: any) {
    const req = await prisma.workRequirement.findUnique({ where: { id } });
    if (!req) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);

    const updated = await prisma.workRequirement.update({ where: { id }, data, include: assignedVendorInclude });
    return toDto(updated);
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

    const updated = await prisma.workRequirement.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedVendorId: vendorId,
        assignedAt: new Date()
      },
      include: assignedVendorInclude
    });
    return toDto(updated);
  }
}
