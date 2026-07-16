export interface SummarizerInput {
  requirementTitle: string;
  requirementPriority: string;
  requirementCategory: string;
  requirementLocation: string;
  rankedVendors: { name: string; rank: number; totalScore: number; breakdown: any }[];
  ineligibleVendors: { name: string; reason: string }[];
  nearExpiryWarnings: { vendorName: string; documentType: string; expiryDate: string }[];
}

export interface Summarizer {
  summarize(input: SummarizerInput): Promise<string>;
}
