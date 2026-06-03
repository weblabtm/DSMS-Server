import 'dotenv/config';
import { TwilioSmsProvider } from '../modules/Notification/infrastructure/sms/TwilioSmsProvider.js';

async function main() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
    const fromNumber = process.env.TWILIO_FROM_NUMBER ?? '';

    console.log('Testing Twilio Outbound Connection:');
    console.log(`- Account SID: ${accountSid ? 'Configured' : 'Missing'}`);
    console.log(`- From Number: ${fromNumber || 'Missing'}`);

    if (!accountSid || !authToken || !fromNumber) {
        console.error('\nError: Missing TWILIO credentials in your .env file!');
        process.exit(1);
    }

    const provider = new TwilioSmsProvider({ accountSid, authToken, fromNumber });
    
    const recipient = process.argv[2];
    if (!recipient) {
        console.log('\nUsage: npx tsx src/scripts/test-twilio.ts <YOUR_VERIFIED_PHONE_NUMBER>');
        console.log('Example: npx tsx src/scripts/test-twilio.ts +15550192834');
        process.exit(1);
    }

    console.log(`\nSending test SMS to ${recipient}...`);
    const result = await provider.sendSms(recipient, 'Hello from DSMS! Twilio credentials verification is successful.');

    if (result.success) {
        console.log('Success! Twilio message dispatched successfully.');
        console.log('Message SID:', result.providerMessageId);
    } else {
        console.error('Failed to send SMS:', result.error);
        console.log('\nTip: If you are using a Twilio Trial account, remember that the recipient phone number MUST be verified inside your Twilio Console under "Verified Caller IDs".');
    }
}

main().catch(console.error);
