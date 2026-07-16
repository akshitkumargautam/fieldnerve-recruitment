// Location is a binary, loosely-defined signal (exact string match), so it carries
// deliberately little weight until it is modeled properly (structured fields / tiers).
export const weightsConfig = {
  LOW: { rating: 0.35, safety: 0.25, compliance: 0.30, location: 0.10 },
  MEDIUM: { rating: 0.35, safety: 0.25, compliance: 0.30, location: 0.10 },
  HIGH: { rating: 0.30, safety: 0.40, compliance: 0.25, location: 0.05 },
  CRITICAL: { rating: 0.30, safety: 0.40, compliance: 0.25, location: 0.05 },
};
