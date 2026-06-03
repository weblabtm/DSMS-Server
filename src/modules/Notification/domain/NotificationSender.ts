import { Notification } from './Notification.js';

export abstract class NotificationSender<T extends Notification> {
    public abstract send(notification: T): Promise<void>;
}
