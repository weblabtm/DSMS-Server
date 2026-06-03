import { describe, expect, it } from 'vitest';
import { isValidTwilioSignature } from '../../../../src/modules/Notification/infrastructure/sms/verifyTwilioSignature.js';

describe('isValidTwilioSignature', () => {
    const authToken = '12345';
    const callbackUrl = 'https://mycompany.com/notifications/sms/callback';
    const params = {
        MessageSid: 'SM12345',
        MessageStatus: 'delivered',
        To: '+1234567890',
        From: '+15555555555'
    };

    it('rejects verification if signature is missing', () => {
        const isValid = isValidTwilioSignature(authToken, undefined, callbackUrl, params);
        expect(isValid).toBe(false);
    });

    it('validates a correct Twilio signature match', () => {
        // Compute correct signature manually for mock values:
        // Concatenate URL and sorted params
        // URL: https://mycompany.com/notifications/sms/callback
        // Sorted keys: From, MessageSid, MessageStatus, To
        // Data: https://mycompany.com/notifications/sms/callbackFrom+15555555555MessageSidSM12345MessageStatusdeliveredTo+1234567890
        // HMAC-SHA1 of this using key '12345'
        // Base64 encoded is the expected signature
        
        const crypto = require('node:crypto');
        const expectedData = 'https://mycompany.com/notifications/sms/callbackFrom+15555555555MessageSidSM12345MessageStatusdeliveredTo+1234567890';
        const hmac = crypto.createHmac('sha1', authToken);
        hmac.update(expectedData);
        const correctSignature = hmac.digest('base64');

        const isValid = isValidTwilioSignature(authToken, correctSignature, callbackUrl, params);
        expect(isValid).toBe(true);
    });

    it('rejects invalid or modified signatures', () => {
        const isValid = isValidTwilioSignature(authToken, 'invalid-signature-value', callbackUrl, params);
        expect(isValid).toBe(false);
    });
});
