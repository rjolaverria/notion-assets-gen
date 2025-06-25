import { Module } from '@nestjs/common';
import { NotionClientService } from './notion-client.service';

@Module({
  providers: [NotionClientService],
  exports: [NotionClientService],
})
export class NotionClientModule {}
