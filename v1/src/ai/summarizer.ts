export interface SummarizerInput {
  requirementTitle: string;
  requirementPriority: string;
  rankedVendors: { name: string; rank: number; totalScore: number; breakdown: any }[];
  nearExpiryWarnings: { vendorName: string; documentType: string; expiryDate: string }[];
}

export interface Summarizer {
  summarize(input: SummarizerInput): Promise<string>;
}
