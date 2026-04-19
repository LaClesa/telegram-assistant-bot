import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { ContextMessage } from '../memory/memory.service';
import { ImageData } from '../files/extractors/image.extractor';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly client: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('anthropic.apiKey'),
    });
  }

  /**
   * Sends a message to Claude with the full conversation context.
   * Uses prompt caching on the system prompt to reduce cost on repeated calls.
   */
  async sendMessage(
    userMessage: string,
    contextMessages: ContextMessage[],
  ): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      ...contextMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            // Prompt caching: system prompt is stable, cache it to save tokens
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      });

      const block = response.content[0];
      if (block.type !== 'text') {
        return 'I encountered an unexpected response format. Please try again.';
      }

      this.logger.debug(
        `Claude usage — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`,
      );

      return block.text;
    } catch (error) {
      this.logger.error('Error calling Claude API', error);
      throw error;
    }
  }

  /**
   * Sends a message that includes an image (Claude vision).
   * The image is passed as a base64 content block alongside the user's caption.
   */
  async sendMessageWithImage(
    image: ImageData,
    caption: string,
    contextMessages: ContextMessage[],
  ): Promise<string> {
    const imageBlock: Anthropic.ImageBlockParam = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.base64,
      },
    };

    const userContent: Anthropic.ContentBlockParam[] = [
      imageBlock,
      { type: 'text', text: caption || 'Please analyse this image.' },
    ];

    const messages: Anthropic.MessageParam[] = [
      ...contextMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ];

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      });

      const block = response.content[0];
      if (block.type !== 'text') {
        return 'I encountered an unexpected response format. Please try again.';
      }

      this.logger.debug(
        `Claude vision usage — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`,
      );

      return block.text;
    } catch (error) {
      this.logger.error('Error calling Claude vision API', error);
      throw error;
    }
  }

  /**
   * Produces a concise summary of a conversation history.
   * Used by MemoryService to compress long sessions into long-term storage.
   */
  async summariseConversation(messages: ContextMessage[]): Promise<string> {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: 'You are a conversation summariser. Produce a concise 3–5 sentence summary of the conversation provided, capturing key facts, decisions, tasks mentioned, and any user preferences revealed. Write in third person. Be specific — include names, topics, and outcomes.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: transcript }],
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }

  /**
   * Detects if the AI response contains a permission request signal.
   * Returns the scope string if found, otherwise null.
   */
  extractPermissionRequest(response: string): string | null {
    const match = response.match(/\[PERMISSION_REQUIRED:\s*([A-Z_]+)\]/);
    return match ? match[1] : null;
  }
}
