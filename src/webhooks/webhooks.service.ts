import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { ConfigService } from '@nestjs/config';
import { WebhookTokenSignatureDto } from './dto/webhook-token-signature.dto';
import { WebhookForbiddenException } from './webhook-forbidden.exception';

@Injectable()
export class WebhooksService {
  private readonly verificationToken?: string;
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private configService: ConfigService) {
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
      this.logger.log(`Received event of type: ${event.type}`);
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
