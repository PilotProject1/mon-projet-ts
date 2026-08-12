import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

@Injectable()
export class AiService {
  private client: Anthropic | null = null;

  get available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  get model(): string {
    return MODEL;
  }

  get sdk(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException(
        "L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY manquant)",
      );
    }
    if (!this.client) {
      this.client = new Anthropic();
    }
    return this.client;
  }
}
