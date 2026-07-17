import OpenAI from 'openai';
import { Summarizer, SummarizerInput } from './summarizer';

// Provider-agnostic: any OpenAI-compatible chat-completions endpoint works
// (Gemini, OpenAI, Anthropic, Groq, OpenRouter, Ollama, ...). Configure via:
//   LLM_API_KEY  - enables the LLM path when set
//   LLM_BASE_URL - defaults to Gemini's OpenAI-compatible endpoint
//   LLM_MODEL    - defaults to a Gemini flash model
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
// 'latest' alias so the default never points at a retired model version
const DEFAULT_MODEL = 'gemini-flash-latest';

const SYSTEM_PROMPT = `You are a procurement assistant for an industrial vendor management platform.
Given the JSON result of a deterministic vendor recommendation run, write a 3-5 sentence plain-language summary for a project manager.

Anchor the explanation in the project itself. Refer to the work by its title naturally (e.g. "for the emergency bridge repair") and let the project's priority and nature come through implicitly in the narrative - never quote the priority as a label like "(CRITICAL priority)". The weightsUsed in each vendor's breakdown show which factors the engine weighted most for this project; connect that to WHY those factors matter for this kind of job (e.g. on an urgent repair, safety record rightly outweighs having a local presence; on routine work, a nearby proven vendor is favored).

Then: explain why the top-ranked vendor won through those dominant factors with its actual scores, how close the runner-up is and where it leads or trails, and briefly note how many vendors were disqualified and the dominant reason. Only mention expiring documents in one short closing clause if any are listed. Do not overstate low-weight factors. Do not invent data, do not use markdown, and never contradict the ranking - it is final.`;

export class LLMSummarizer implements Summarizer {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
      // Generous timeout: current-gen flash models think before answering, and
      // free-tier endpoints can be slow under load. Retries cover transient 503s.
      timeout: 45_000,
      maxRetries: 2
    });
    this.model = process.env.LLM_MODEL || DEFAULT_MODEL;
  }

  async summarize(input: SummarizerInput): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(input) }
      ]
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('LLM returned an empty summary');
    return text;
  }
}
