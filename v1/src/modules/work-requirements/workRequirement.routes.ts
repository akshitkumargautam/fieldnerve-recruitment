import { Router } from 'express';
import { WorkRequirementController } from './workRequirement.controller';
import { asyncHandler } from '../../shared/asyncHandler';

export const workRequirementRoutes = Router();
const controller = new WorkRequirementController();

workRequirementRoutes.post('/', asyncHandler(controller.createWorkRequirement.bind(controller)));
workRequirementRoutes.get('/', asyncHandler(controller.getWorkRequirements.bind(controller)));
workRequirementRoutes.get('/:id', asyncHandler(controller.getWorkRequirementById.bind(controller)));
workRequirementRoutes.patch('/:id', asyncHandler(controller.updateWorkRequirement.bind(controller)));
workRequirementRoutes.post('/:id/assign', asyncHandler(controller.assignVendor.bind(controller)));
