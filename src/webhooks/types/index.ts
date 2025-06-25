export type WebhookEventType =
  | 'page.content_updated'
  | 'page.created'
  | 'page.deleted'
  | 'page.locked'
  | 'page.moved'
  | 'page.properties_updated'
  | 'page.undeleted'
  | 'page.unlocked'
  | 'database.content_updated'
  | 'database.created'
  | 'database.deleted'
  | 'database.moved'
  | 'database.schema_updated'
  | 'database.undeleted'
  | 'comment.created'
  | 'comment.deleted'
  | 'comment.updated';

export type EntityType = 'page' | 'database' | 'comment';

export type UserType = 'person' | 'bot' | 'agent';

export type ContentUpdatedData = {
  parent: {
    id: string;
    type: 'space' | EntityType;
  };
  updated_blocks: {
    id: string;
    type: 'block';
  }[];
};
