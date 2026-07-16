import OpenAI from 'openai';
import { Summarizer, SummarizerInput } from './summarizer';

// Provider-agnostic: any OpenAI-compatible chat-completions endpoint works
// (Gemini, OpenAI, Anthropic, Groq, OpenRouter, Ollama, ...). Configure via:
//   LLM_API_KEY  - enables the LLM path when set
//   LLM_BASE_URL - defaults to Gemini's OpenAI-compatible endpoint
//   LLM_MODEL    - defaults to a Gemini flash model
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const DEFAULT_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are a procurement assistant for an industrial vendor management platform.
Given the JSON result of a deterministic vendor recommendation run, write a 3-5 sentence plain-language summary for a project manager. Explain why the top-ranked vendor won by referencing its actual scores and the weighted factors (rating, safety, compliance, location), how close the runner-up is and where it leads or trails, and briefly note how many vendors were disqualified and the dominant reason. Only mention expiring documents in one short closing clause if any are listed. Do not invent data, do not use markdown, and never contradict the ranking - it is final.`;

export class LLMSummarizer implements Summarizer {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
      timeout: 15_000,
      maxRetries: 1
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
