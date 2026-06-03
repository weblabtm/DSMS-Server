import type { RoleName } from '../../../Auth/domain/Role.js';

export type InvitationChannel = 'email' | 'sms' | 'whatsapp' | 'push';

export type AccountInvitation = {
    recipientName: string;
    recipientEmail?: string;
    recipientPhone?: string;
    requestedByUserId: string;
    roleName: RoleName;
    tenantId?: string;
    branchId?: string;
    channel: InvitationChannel;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
};

export interface AccountInvitationNotifier {
    sendInvitation(invitation: AccountInvitation): Promise<void>;
}
