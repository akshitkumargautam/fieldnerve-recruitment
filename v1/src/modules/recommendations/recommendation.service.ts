import { prisma } from '../../db/prismaClient';
import { AppError } from '../../shared/errors';
import { evaluateEligibility } from './filters';
import { calculateScore } from './scoring';
import { LLMSummarizer } from '../../ai/llmSummarizer';
import { FallbackSummarizer } from '../../ai/fallbackSummarizer';
import { SummarizerInput } from '../../ai/summarizer';

// LLM path is opt-in via LLM_API_KEY; any LLM failure degrades to the
// deterministic fallback instead of failing the request.
async function generateSummary(input: SummarizerInput): Promise<{ text: string; source: 'llm' | 'fallback' }> {
  if (process.env.LLM_API_KEY) {
    try {
      return { text: await new LLMSummarizer().summarize(input), source: 'llm' };
    } catch (err) {
      console.error('LLM summarization failed, using fallback:', err instanceof Error ? err.message : err);
    }
  }
  return { text: await new FallbackSummarizer().summarize(input), source: 'fallback' };
}

export class RecommendationService {
  async runRecommendations(workRequirementId: string) {
    const requirement = await prisma.workRequirement.findUnique({ where: { id: workRequirementId } });
    if (!requirement) throw new AppError('Work requirement not found', 'NOT_FOUND', 404);

    const vendors = await prisma.vendor.findMany({ include: { documents: true } });

    const results = vendors.map(vendor => {
      const eligibility = evaluateEligibility(vendor, requirement);

      if (!eligibility.eligible) {
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          eligible: false,
          disqualificationReason: eligibility.reason,
          totalScore: null,
          scoreBreakdown: null,
          rank: null
        };
      }

      const score = calculateScore(vendor, requirement);
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        safetyRating: vendor.safetyRating, // Needed for tie-breaking
        eligible: true,
        disqualificationReason: null,
        totalScore: score.totalScore,
        scoreBreakdown: score.scoreBreakdown,
        rank: null
      };
    });

    const eligibleResults = results.filter(r => r.eligible) as any[];

    eligibleResults.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.safetyRating !== a.safetyRating) return Number(b.safetyRating) - Number(a.safetyRating);
      return a.vendorName.localeCompare(b.vendorName);
    });

    eligibleResults.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    const allResults = results.map(r => {
      const isEligible = eligibleResults.find(er => er.vendorId === r.vendorId);
      return isEligible || r;
    });

    const run = await prisma.recommendationRun.create({
      data: {
        workRequirementId,
      }
    });

    const resultData = allResults.map(r => ({
      recommendationRunId: run.id,
      vendorId: r.vendorId,
      eligible: r.eligible,
      disqualificationReason: r.disqualificationReason,
      totalScore: r.totalScore,
      scoreBreakdown: r.scoreBreakdown ? JSON.stringify(r.scoreBreakdown) : null,
      rank: r.rank
    }));

    await prisma.recommendationResult.createMany({ data: resultData });

    // Prepare AI Summary
    const top5 = eligibleResults.slice(0, 5).map(r => ({
      name: r.vendorName,
      rank: r.rank,
      totalScore: r.totalScore,
      breakdown: r.scoreBreakdown
    }));

    const top5VendorIds = eligibleResults.slice(0, 5).map(r => r.vendorId);

    const now = new Date();
    const plus30 = new Date(now);
    plus30.setDate(now.getDate() + 30);

    const nearExpiryWarnings: any[] = [];
    vendors.forEach(v => {
      if (top5VendorIds.includes(v.id)) {
        v.documents.forEach(d => {
          if (d.status === 'VALID' && d.expiryDate && d.expiryDate <= plus30 && d.expiryDate >= now) {
            nearExpiryWarnings.push({
              vendorName: v.name,
              documentType: d.documentType,
              expiryDate: d.expiryDate.toISOString().split('T')[0]
            });
          }
        });
      }
    });

    const summaryInput: SummarizerInput = {
      requirementTitle: requirement.title,
      requirementPriority: requirement.priority,
      requirementCategory: requirement.category,
      requirementLocation: requirement.location,
      rankedVendors: top5,
      ineligibleVendors: allResults
        .filter(r => !r.eligible)
        .map(r => ({ name: r.vendorName, reason: r.disqualificationReason ?? 'Unknown' })),
      nearExpiryWarnings
    };

    const { text: aiSummary, source: aiSummarySource } = await generateSummary(summaryInput);

    await prisma.recommendationRun.update({
      where: { id: run.id },
      data: { aiSummary }
    });

    return {
      runId: run.id,
      generatedAt: run.generatedAt,
      aiSummary,
      aiSummarySource,
      ranked: eligibleResults.slice(0, 5).map(r => ({
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        eligible: r.eligible,
        disqualificationReason: r.disqualificationReason,
        totalScore: r.totalScore,
        scoreBreakdown: r.scoreBreakdown,
        rank: r.rank
      })),
      ineligible: allResults.filter(r => !r.eligible).map(r => ({
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        eligible: r.eligible,
        disqualificationReason: r.disqualificationReason,
        totalScore: r.totalScore,
        scoreBreakdown: r.scoreBreakdown,
        rank: r.rank
      }))
    };
  }

  async getRecommendations(workRequirementId: string, all: boolean = false) {
    const runs = await prisma.recommendationRun.findMany({
      where: { workRequirementId },
      orderBy: { generatedAt: 'desc' },
      include: { results: { include: { vendor: { select: { name: true } } } } },
      take: all ? undefined : 1
    });

    if (runs.length === 0) throw new AppError('No recommendations found', 'NOT_FOUND', 404);

    const toDto = (r: any) => ({
      id: r.id,
      recommendationRunId: r.recommendationRunId,
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      eligible: r.eligible,
      disqualificationReason: r.disqualificationReason,
      totalScore: r.totalScore,
      scoreBreakdown: r.scoreBreakdown ? JSON.parse(r.scoreBreakdown) : null,
      rank: r.rank
    });

    return runs.map(run => {
      const ranked = run.results.filter((r: any) => r.eligible).sort((a: any, b: any) => a.rank - b.rank).slice(0, 5);
      const ineligible = run.results.filter((r: any) => !r.eligible);

      return {
        runId: run.id,
        generatedAt: run.generatedAt,
        aiSummary: run.aiSummary,
        ranked: ranked.map(toDto),
        ineligible: ineligible.map(toDto)
      };
    });
  }
}
