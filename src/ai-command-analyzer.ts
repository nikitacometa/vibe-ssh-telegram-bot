import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from './config';
import { logger } from './logger';

const CommandSuggestionSchema = z.object({
  commands: z.array(z.string()).min(1).max(4),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.enum([
    'files',
    'system',
    'network',
    'processes',
    'text',
    'logs',
    'services',
    'docker',
    'git',
    'packages'
  ])
});

export type AICommandSuggestion = z.infer<typeof CommandSuggestionSchema>;

/** Analyzes natural-language requests and suggests safe, practical shell commands. */
export class AICommandAnalyzer {
  private readonly openai: OpenAI | null;

  /** Creates an analyzer, initializing OpenAI only when an API key is configured. */
  constructor() {
    this.openai = config.openaiApiKey
      ? new OpenAI({ apiKey: config.openaiApiKey })
      : null;
  }

  /** Returns a validated command suggestion, or null when AI analysis is unavailable. */
  async analyzeIntent(userMessage: string): Promise<AICommandSuggestion | null> {
    if (!this.openai) {
      return null;
    }

    try {
      const completion = await this.openai.chat.completions.parse({
        model: config.openaiModelName,
        messages: [
          {
            role: 'system',
            content: `You are a Linux command expert. Convert the user's request into 1-4 practical shell commands, a concise explanation, a confidence score from 0 to 1, and exactly one category.

Categories: files, system, network, processes, text, logs, services, docker, git, packages.

Prefer safe, non-destructive commands and commonly available tools. Include useful flags when appropriate. Incorporate specific filenames, paths, services, hosts, or other concrete details from the request. Keep commands concise and directly usable.`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        response_format: zodResponseFormat(
          CommandSuggestionSchema,
          'command_suggestion'
        ),
        temperature: 0.2,
        max_completion_tokens: 400
      });

      return completion.choices[0]?.message.parsed ?? null;
    } catch (error: unknown) {
      logger.error('OpenAI command analysis failed; falling back to regex parsing:', error);
      return null;
    }
  }

  /** Reports whether an OpenAI client is configured and ready for requests. */
  isAvailable(): boolean {
    return this.openai !== null;
  }
}
