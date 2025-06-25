import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { ConfigService } from '@nestjs/config';
import { WebhookTokenSignatureDto } from './dto/webhook-token-signature.dto';
import { WebhookForbiddenException } from './webhook-forbidden.exception';
import { NotionClientService } from 'src/notion-client/notion-client.service';

@Injectable()
export class WebhooksService {
  private readonly verificationToken?: string;
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notionClientService: NotionClientService,
  ) {
    this.verificationToken = this.configService.get<string>(
      'NOTION_VERIFICATION_TOKEN',
    );
  }

  handleNotionWebhook(
    event: WebhookEventDto | WebhookTokenSignatureDto,
    signature?: string,
  ): void {
    if ('verification_token' in event) {
      this.logger.log(
        `Received verification token: ${event.verification_token}`,
      );
    } else if ('type' in event) {
      this.verifyNotionWebhook(event, signature);
      void this.handleNotionWebhookEvent(event);
    }
  }

  private async handleNotionWebhookEvent(
    event: WebhookEventDto,
  ): Promise<void> {
    switch (event.type) {
      case 'page.content_updated':
        await this.handlePageContentUpdated(
          event as WebhookEventDto<'page.content_updated'>,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
        break;
    }
  }

  private async handlePageContentUpdated(
    event: WebhookEventDto<'page.content_updated'>,
  ): Promise<void> {
    this.logger.log(
      `Handling page content updated event for page: ${event.entity.id}`,
    );
    const updatedBlocks = event.data.updated_blocks || [];
    await Promise.all(
      updatedBlocks.map((block) =>
        this.handleBlockUpdated(block.id, event.entity.id),
      ),
    );
  }

  private async handleBlockUpdated(
    blockId: string,
    pageId: string,
  ): Promise<void> {
    try {
      const block = await this.notionClientService.getBlockById(blockId);
      if (!block) {
        this.logger.warn(`Block with ID ${blockId} not found.`);
        return;
      }
      const shouldGenerate =
        NotionClientService.isPlaceholderBlock(block) &&
        !block.in_trash &&
        !block.archived;

      if (shouldGenerate) {
        const strippedContent =
          NotionClientService.extractPlaceholderText(block);
        const context = await this.notionClientService.getAllPageContent(
          pageId,
          block.id,
        );
        this.logger.log(
          `Generating image for block: ${strippedContent}, context: ${context}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error handling block update for ID ${blockId}:`,
        error,
      );
      return;
    }
  }

  private verifyNotionWebhook(
    body: WebhookEventDto,
    signature?: string,
  ): boolean {
    if (!this.verificationToken) {
      return true;
    }

    if (!signature) {
      throw new WebhookForbiddenException(
        'Signature is missing in the request headers.',
      );
    }

    const calculatedSignature = `sha256=${createHmac('sha256', this.verificationToken).update(JSON.stringify(body)).digest('hex')}`;

    let isTrustedPayload = false;
    try {
      isTrustedPayload = timingSafeEqual(
        Buffer.from(calculatedSignature),
        Buffer.from(signature),
      );
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      throw new WebhookForbiddenException('Signature verification failed.');
    }

    if (!isTrustedPayload) {
      throw new WebhookForbiddenException(
        'Signature does not match the calculated signature.',
      );
    }

    return true;
  }
}
