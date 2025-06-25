import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { NotionClientModule } from 'src/notion-client/notion-client.module';
import { GenaiModule } from 'src/genai/genai.module';

@Module({
  imports: [NotionClientModule, GenaiModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
