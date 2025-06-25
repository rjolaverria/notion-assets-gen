import { ContentUpdatedData, type WebhookEventType } from '../types';
import { WebhookAccessibleByDto } from './webhook-accessible-by.dto';
import { WebhookEntityDto } from './webhook-entity.dto';
import { WebhookEventAuthorDto } from './webhook-event-author.dto';

// could use descriminate union for better types, but this is cool for now
export class WebhookEventDto<T extends WebhookEventType = WebhookEventType> {
  id: string;
  timestamp: string;
  workspace_id: string;
  subscription_id: string;
  integration_id: string;
  type: T;
  authors: WebhookEventAuthorDto[];
  accessible_by?: WebhookAccessibleByDto[];
  attempt_number: number;
  entity: WebhookEntityDto;
  data: T extends 'page.content_updated'
    ? ContentUpdatedData
    : Record<string, unknown>;
}
