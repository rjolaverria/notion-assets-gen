import { Module } from '@nestjs/common';
import { GenaiService } from './genai.service';

@Module({
  providers: [GenaiService],
  exports: [GenaiService],
})
export class GenaiModule {}
