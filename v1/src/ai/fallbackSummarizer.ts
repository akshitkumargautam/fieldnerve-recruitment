import { Summarizer, SummarizerInput } from './summarizer';

const FACTOR_LABELS: Record<string, string> = {
  ratingScore: 'overall rating',
  safetyScore: 'safety record',
  complianceScore: 'document compliance',
  locationScore: 'location match'
};

// Weighted contribution of each factor to a vendor's total, so the summary can
// name the factors that actually decided the ranking.
function contributions(breakdown: any): { key: string; value: number }[] {
  const weights = breakdown.weightsUsed;
  return [
    { key: 'ratingScore', value: breakdown.ratingScore * weights.rating },
    { key: 'safetyScore', value: breakdown.safetyScore * weights.safety },
    { key: 'complianceScore', value: breakdown.complianceScore * weights.compliance },
    { key: 'locationScore', value: breakdown.locationScore * weights.location }
  ].sort((a, b) => b.value - a.value);
}

export class FallbackSummarizer implements Summarizer {
  async summarize(input: SummarizerInput): Promise<string> {
    const top = input.rankedVendors[0];
    if (!top) {
      return `No eligible vendors found for ${input.requirementTitle}. ${input.ineligibleVendors.length} vendor(s) were disqualified during eligibility checks.`;
    }

    const topFactors = contributions(top.breakdown).slice(0, 2).map(c => FACTOR_LABELS[c.key]);
    const parts: string[] = [
      `${top.name} ranks #1 for ${input.requirementTitle} (${input.requirementPriority} priority) with a score of ${top.totalScore}, driven mainly by ${topFactors[0]} and ${topFactors[1]}.`
    ];

    const runnerUp = input.rankedVendors[1];
    if (runnerUp) {
      const gap = Math.round((top.totalScore - runnerUp.totalScore) * 10) / 10;
      const topC = contributions(top.breakdown);
      const runnerC = contributions(runnerUp.breakdown);
      let biggestDeficit = { key: 'ratingScore', value: 0 };
      for (const rc of runnerC) {
        const tc = topC.find(c => c.key === rc.key)!;
        const deficit = tc.value - rc.value;
        if (deficit > biggestDeficit.value) biggestDeficit = { key: rc.key, value: deficit };
      }
      parts.push(`${runnerUp.name} follows at ${runnerUp.totalScore}, ${gap} points behind, losing ground mostly on ${FACTOR_LABELS[biggestDeficit.key]}.`);
    }

    if (input.ineligibleVendors.length > 0) {
      parts.push(`${input.ineligibleVendors.length} vendor(s) were disqualified during eligibility checks before scoring.`);
    }

    if (input.nearExpiryWarnings.length > 0) {
      // Aggregate per vendor so a batch of expiring documents stays one clause,
      // not the centerpiece of the summary.
      const byVendor = new Map<string, typeof input.nearExpiryWarnings>();
      for (const w of input.nearExpiryWarnings) {
        if (!byVendor.has(w.vendorName)) byVendor.set(w.vendorName, []);
        byVendor.get(w.vendorName)!.push(w);
      }
      const clauses = [...byVendor.entries()].map(([vendor, ws]) =>
        ws.length === 1
          ? `${vendor}'s ${ws[0].documentType} (${ws[0].expiryDate})`
          : `${ws.length} of ${vendor}'s documents`
      );
      parts.push(`Heads-up: expiring within 30 days - ${clauses.join('; ')}.`);
    }

    return parts.join(' ');
  }
}
