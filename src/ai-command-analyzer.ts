import OpenAI from 'openai';
import { config } from './config';

export interface AICommandSuggestion {
  commands: string[];
  explanation: string;
  confidence: number;
  category: string;
}

export class AICommandAnalyzer {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }
  }

  async analyzeIntent(userMessage: string): Promise<AICommandSuggestion | null> {
    if (!this.openai) {
      console.warn('OpenAI API key not configured, falling back to basic parsing');
      return null;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openaiModelName,
        messages: [
          {
            role: 'system',
            content: `You are a Linux command expert. Analyze user requests and suggest appropriate bash commands.

Your task:
1. Understand what the user wants to accomplish
2. Suggest 2-4 relevant Linux/bash commands 
3. Provide a brief explanation
4. Rate your confidence (0.1-1.0)
5. Categorize the request

Categories: files, system, network, processes, text, logs, services, docker, git, packages

Response format (JSON only):
{
  "commands": ["command1", "command2", "command3"],
  "explanation": "Brief explanation of what these commands do",
  "confidence": 0.8,
  "category": "files"
}

Rules:
- Always suggest practical, commonly used commands
- Include command options/flags when helpful
- For file operations, use generic filenames unless specific names mentioned
- Prioritize safer commands (avoid rm -rf unless clearly requested)
- If user mentions specific filenames, incorporate them
- For system info: prefer commands like df -h, free -h, ps aux, top
- For network: netstat, ss, ping, curl, wget
- Keep commands concise and practical`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Parse the JSON response
      const suggestion = JSON.parse(content) as AICommandSuggestion;
      
      // Validate the response
      if (!suggestion.commands || !Array.isArray(suggestion.commands) || suggestion.commands.length === 0) {
        return null;
      }

      // Ensure confidence is within bounds
      suggestion.confidence = Math.max(0.1, Math.min(1.0, suggestion.confidence || 0.5));

      return suggestion;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }
}