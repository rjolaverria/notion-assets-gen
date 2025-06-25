import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { ConfigService } from '@nestjs/config';
import { WebhookTokenSignatureDto } from './dto/webhook-token-signature.dto';
import { WebhookForbiddenException } from './webhook-forbidden.exception';
import { NotionClientService } from 'src/notion-client/notion-client.service';
import { GenaiService } from 'src/genai/genai.service';

@Injectable()
export class WebhooksService {
  private readonly verificationToken?: string;
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notionClientService: NotionClientService,
    private readonly genaiService: GenaiService,
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
    const updatedBlocks = event.data.updated_blocks || [];

    if (updatedBlocks.length === 0) {
      this.logger.warn('No updated blocks found in the event data.');
      return;
    }

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
      if (
        !block ||
        block.archived ||
        block.in_trash ||
        !NotionClientService.isPlaceholderBlock(block)
      ) {
        this.logger.warn(`Skipping block [id=${blockId}]`);
        return;
      }

      const strippedContent = NotionClientService.extractPlaceholderText(block);
      const context = await this.notionClientService.getAllPageContent(
        pageId,
        block.id,
      );
      const buf = await this.genaiService.generateImage(
        context,
        strippedContent,
      );

      if (!buf) {
        this.logger.warn(
          `No image generated for block: ${JSON.stringify(block, null, 2)}`,
        );
        return;
      }

      const fileUploadReq = await this.notionClientService.createFileUpload();
      const fileUpload = await this.notionClientService.sendFileUpload(
        fileUploadReq.id,
        buf,
      );

      await this.notionClientService.appendBlockChildren(
        pageId,
        fileUpload.id,
        block.id,
      );
      await this.notionClientService.deleteBlock(block.id);
    } catch (error: unknown) {
      this.logger.error(
        `Error handling block update for ID ${blockId}:`,
        error,
      );
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
