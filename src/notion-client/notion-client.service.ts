import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlockObjectResponse,
  Client as NotionClient,
  ParagraphBlockObjectResponse,
} from '@notionhq/client';

@Injectable()
export class NotionClientService {
  private client: NotionClient;
  private readonly logger = new Logger(NotionClientService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('NOTION_TOKEN');
    this.client = new NotionClient({
      auth: apiKey,
    });
  }

  async getBlockById(blockId: string) {
    try {
      return (await this.client.blocks.retrieve({
        block_id: blockId,
      })) as BlockObjectResponse;
    } catch (error) {
      this.logger.error(`Error retrieving block with ID ${blockId}:`, error);
      return null;
    }
  }

  async getAllPageContent(pageId: string, except: string): Promise<string> {
    let allBlocks: BlockObjectResponse[] = [];
    let startCursor;
    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100,
      });
      allBlocks = allBlocks.concat(response.results as BlockObjectResponse[]);
      startCursor = response.next_cursor;
    } while (startCursor);

    const textContent = allBlocks
      .filter(
        (block) =>
          (block.type === 'paragraph' ||
            block.type === 'heading_1' ||
            block.type === 'heading_2' ||
            block.type === 'heading_3') &&
          block.id !== except,
      )
      .map((block: ParagraphBlockObjectResponse) => block[block.type].rich_text)
      .flat()
      .map((richText) => richText.plain_text)
      .join('\n');

    return textContent;
  }

  static isPlaceholderBlock(
    block: BlockObjectResponse | null,
  ): block is ParagraphBlockObjectResponse {
    if (block?.type === 'paragraph' && block.paragraph.rich_text.length === 1) {
      const text = NotionClientService.getBlockText(block);
      if (text.startsWith('<') && text.endsWith('>')) {
        return true;
      }
    }

    return false;
  }

  static extractPlaceholderText(block: ParagraphBlockObjectResponse): string {
    const text = NotionClientService.getBlockText(block);

    return text.length > 2 ? text.slice(1, -1).trim() : '';
  }

  static getBlockText(block: ParagraphBlockObjectResponse) {
    return block.paragraph.rich_text.map((rt) => rt.plain_text).join('');
  }
}
