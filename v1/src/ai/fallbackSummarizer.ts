import { Summarizer, SummarizerInput } from './summarizer';

export class FallbackSummarizer implements Summarizer {
  async summarize(input: SummarizerInput): Promise<string> {
    const topVendor = input.rankedVendors[0];
    if (!topVendor) return 'No eligible vendors found.';
    
    let summary = `${topVendor.name} ranks #1 with a score of ${topVendor.totalScore}.`;
    
    if (input.nearExpiryWarnings.length > 0) {
      const warnings = input.nearExpiryWarnings.map(w => `${w.vendorName}'s ${w.documentType} expires on ${w.expiryDate}`).join(', ');
      summary += ` Note: ${warnings}.`;
    }
    
    return summary;
  }
}
