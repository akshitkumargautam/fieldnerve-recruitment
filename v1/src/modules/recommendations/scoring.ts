import { weightsConfig } from './weights.config';

export function calculateScore(vendor: any, requirement: any) {
  const ratingScore = Number(vendor.rating) / 5;
  const safetyScore = Number(vendor.safetyRating) / 5;
  
  const validDocsCount = vendor.documents.filter((d: any) => d.status === 'VALID').length;
  const complianceScore = Math.min(validDocsCount / 5, 1); // out of 5 document types
  
  const locationScore = (vendor.operatingLocation.trim().toLowerCase() === requirement.location.trim().toLowerCase()) ? 1.0 : 0.0;

  const weights = weightsConfig[requirement.priority as keyof typeof weightsConfig];
  
  const rawScore = (ratingScore * weights.rating) + (safetyScore * weights.safety) + (complianceScore * weights.compliance) + (locationScore * weights.location);
  
  const totalScore = Math.round(rawScore * 100 * 10) / 10; // 1 decimal place
  
  return {
    totalScore,
    scoreBreakdown: {
      ratingScore,
      safetyScore,
      complianceScore,
      locationScore,
      weightsUsed: weights
    }
  };
}
