import { Request, Response } from 'express';
import { RecommendationService } from './recommendation.service';

const recService = new RecommendationService();

export class RecommendationController {
  async runRecommendations(req: Request, res: Response) {
    const result = await recService.runRecommendations(req.params.id);
    res.status(201).json({ data: result });
  }

  async getRecommendations(req: Request, res: Response) {
    const all = req.query.all === 'true';
    const result = await recService.getRecommendations(req.params.id, all);
    res.status(200).json({ data: all ? result : result[0] });
  }
}
