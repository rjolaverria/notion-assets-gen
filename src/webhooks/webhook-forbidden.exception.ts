export class WebhookForbiddenException extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'WebhookForbiddenException';
    Object.setPrototypeOf(this, WebhookForbiddenException.prototype);
  }
}
