import { Router } from 'express';
import { RecommendationController } from './recommendation.controller';
import { asyncHandler } from '../../shared/asyncHandler';

export const recommendationRoutes = Router({ mergeParams: true });
const controller = new RecommendationController();

recommendationRoutes.post('/', asyncHandler(controller.runRecommendations.bind(controller)));
recommendationRoutes.get('/', asyncHandler(controller.getRecommendations.bind(controller)));
