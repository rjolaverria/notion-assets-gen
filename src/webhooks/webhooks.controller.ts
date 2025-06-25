import {
  Controller,
  Post,
  Body,
  HttpCode,
  Headers,
  HttpException,
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { WebhookForbiddenException } from './webhook-forbidden.exception';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('/notion')
  @HttpCode(200)
  notionWebhook(
    @Headers('x-notion-signature') signature: string,
    @Body() event: WebhookEventDto,
  ) {
    try {
      this.webhooksService.handleNotionWebhook(event, signature);
    } catch (error) {
      this.handleException(error);
    }
  }

  handleException(error: unknown) {
    if (error instanceof WebhookForbiddenException) {
      this.logger.warn('Forbidden webhook request', error);
      throw new HttpException(error.message, 403);
    }

    this.logger.error('Error processing Notion webhook', error);
    throw new HttpException('Internal Server Error', 500);
  }
}
