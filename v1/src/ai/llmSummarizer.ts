import { Summarizer, SummarizerInput } from './summarizer';

export class LLMSummarizer implements Summarizer {
  async summarize(input: SummarizerInput): Promise<string> {
    // Basic mock of LLM summarizer as per assignment instructions.
    // If an actual LLM provider was used, the API call would be here.
    return `[LLM Summary] ${input.rankedVendors[0]?.name} is the top choice for ${input.requirementTitle}. ${input.nearExpiryWarnings.length > 0 ? 'Warning: Some docs expiring soon.' : ''}`;
  }
}
