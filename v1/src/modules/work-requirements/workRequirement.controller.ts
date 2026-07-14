import { Request, Response } from 'express';
import { WorkRequirementService } from './workRequirement.service';
import { workRequirementCreateSchema, workRequirementUpdateSchema, workRequirementAssignSchema } from './workRequirement.validation';

const reqService = new WorkRequirementService();

export class WorkRequirementController {
  async createWorkRequirement(req: Request, res: Response) {
    const data = workRequirementCreateSchema.parse(req.body);
    const result = await reqService.createWorkRequirement(data);
    res.status(201).json({ data: result });
  }

  async getWorkRequirements(req: Request, res: Response) {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.priority) filters.priority = req.query.priority;

    const results = await reqService.getWorkRequirements(filters);
    res.status(200).json({ data: results });
  }

  async getWorkRequirementById(req: Request, res: Response) {
    const result = await reqService.getWorkRequirementById(req.params.id);
    res.status(200).json({ data: result });
  }

  async updateWorkRequirement(req: Request, res: Response) {
    const data = workRequirementUpdateSchema.parse(req.body);
    const result = await reqService.updateWorkRequirement(req.params.id, data);
    res.status(200).json({ data: result });
  }

  async assignVendor(req: Request, res: Response) {
    const data = workRequirementAssignSchema.parse(req.body);
    const result = await reqService.assignVendor(req.params.id, data.vendorId);
    res.status(200).json({ data: result });
  }
}
