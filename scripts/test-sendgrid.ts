import 'dotenv/config';
import { SendGridEmailProvider } from '../src/modules/Notification/infrastructure/email/SendGridEmailProvider.js';

async function main() {
    const apiKey = process.env.SENDGRID_API_KEY ?? '';
    const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? '';
    const fromName = process.env.SENDGRID_FROM_NAME ?? 'DSMS';

    console.log('Testing SendGrid Outbound Email Connection:');
    console.log(`- API Key:    ${apiKey ? 'Configured' : 'Missing'}`);
    console.log(`- From Email: ${fromEmail || 'Missing'}`);
    console.log(`- From Name:  ${fromName}`);

    if (!apiKey || !fromEmail) {
        console.error('\nError: Missing SENDGRID credentials in your .env file!');
        process.exit(1);
    }

    const provider = new SendGridEmailProvider({ apiKey, fromEmail, fromName });
    
    const recipient = process.argv[2];
    if (!recipient) {
        console.log('\nUsage: npx tsx scripts/test-sendgrid.ts <RECIPIENT_EMAIL_ADDRESS>');
        console.log('Example: npx tsx scripts/test-sendgrid.ts user@example.com');
        process.exit(1);
    }

    console.log(`\nSending test email to ${recipient}...`);
    const result = await provider.sendEmail(
        recipient, 
        'Hello from DSMS! SendGrid connection verified',
        '<h1>SendGrid Integration Working</h1><p>Your SendGrid outbound email provider is fully set up and configured correctly.</p>'
    );

    if (result.success) {
        console.log('Success! SendGrid email dispatched successfully.');
        console.log('Message ID:', result.providerMessageId);
    } else {
        console.error('Failed to send email:', result.error);
        console.log('\nTip: Make sure the SENDGRID_FROM_EMAIL matches a verified Single Sender or Verified Domain inside your SendGrid Sender Authentication dashboard.');
    }
}

main().catch(console.error);
