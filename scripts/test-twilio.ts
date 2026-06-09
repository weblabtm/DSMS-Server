/**
 * Twilio Outbound SMS — Test Script
 *
 * Verifies Twilio credentials and tests the alphanumeric sender ID feature.
 *
 * Usage:
 *   npx tsx scripts/test-twilio.ts <RECIPIENT_NUMBER> [TENANT_NAME]
 *
 * Examples:
 *   npx tsx scripts/test-twilio.ts +94771234567
 *   npx tsx scripts/test-twilio.ts +94771234567 "TechSchool"
 *
 * When TENANT_NAME is supplied it is used as the Twilio From sender (simulating
 * what happens in production when a tenant's registered name is passed to
 * SmsNotification as the senderName). If omitted, falls back to TWILIO_ALPHA_SENDER
 * env var, then TWILIO_FROM_NUMBER.
 */
import 'dotenv/config';
import { TwilioSmsProvider } from '../src/modules/Notification/infrastructure/sms/TwilioSmsProvider.js';
import { buildAlphaSenderId } from '../src/modules/Notification/application/services/SmsNotificationService.js';

async function main() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID  ?? '';
    const authToken  = process.env.TWILIO_AUTH_TOKEN   ?? '';
    const fromNumber = process.env.TWILIO_FROM_NUMBER  ?? '';
    const alphaId    = process.env.TWILIO_ALPHA_SENDER ?? ''; // system-level default

    // CLI args
    const recipient   = process.argv[2] ?? '';
    const tenantName  = process.argv[3] ?? ''; // optional: simulate a specific tenant's name

    // Resolve effective sender — same priority as production:
    //   1. Tenant name supplied on CLI (simulates Pattern 2 / caller-supplied senderName)
    //   2. TWILIO_ALPHA_SENDER env var   (system-level default)
    //   3. TWILIO_FROM_NUMBER            (phone number fallback)
    const resolvedAlpha = tenantName ? buildAlphaSenderId(tenantName) : undefined;
    const effectiveSender = resolvedAlpha || alphaId.trim() || fromNumber;

    console.log('\n=== Twilio Outbound SMS — Test Script ===');
    console.log(`  Account SID      : ${accountSid ? 'Configured ✓' : 'MISSING ✗'}`);
    console.log(`  From Number      : ${fromNumber  || '(not set)'}`);
    console.log(`  Env Alpha Sender : ${alphaId     ? `"${alphaId}"` : '(not set)'}`);

    if (tenantName) {
        console.log(`  CLI Tenant Name  : "${tenantName}" → sanitised alpha ID: "${resolvedAlpha ?? '(invalid — see rules below)'}"`);
    }

    console.log(`  Effective From   : ${effectiveSender || 'NONE — no sender configured!'}`);

    if (!accountSid || !authToken) {
        console.error('\n✗ TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required in your .env file.');
        process.exit(1);
    }

    if (!effectiveSender) {
        console.error('\n✗ No sender configured. Set at least one of:');
        console.error('    TWILIO_FROM_NUMBER     (phone number)');
        console.error('    TWILIO_ALPHA_SENDER    (alphanumeric name, env var)');
        console.error('    Pass a tenant name as the 2nd CLI argument');
        process.exit(1);
    }

    if (!recipient) {
        console.log('\nUsage:');
        console.log('  npx tsx scripts/test-twilio.ts <RECIPIENT_NUMBER> [TENANT_NAME]');
        console.log('\nExamples:');
        console.log('  npx tsx scripts/test-twilio.ts +94771234567');
        console.log('  npx tsx scripts/test-twilio.ts +94771234567 "TechSchool"');
        console.log('\nAlphanumeric Sender ID rules:');
        console.log('  • Max 11 characters (letters & digits only — spaces and symbols stripped)');
        console.log('  • One-way only — recipients cannot reply');
        console.log('  • Not available in the US. See: https://help.twilio.com/articles/223133767');
        process.exit(1);
    }

    const provider = new TwilioSmsProvider({
        accountSid,
        authToken,
        fromNumber,
        alphaId: resolvedAlpha || alphaId || undefined,
    });

    console.log(`\nSending test SMS to ${recipient} from "${effectiveSender}"...`);
    const result = await provider.sendSms(
        recipient,
        `Hello from DSMS! Sent from "${effectiveSender}". Twilio credentials verified ✓`,
        undefined,
        // Pass resolvedAlpha as fromOverride so it takes priority over the configured alphaId
        resolvedAlpha
    );

    if (result.success) {
        console.log('\n✓ Success! Message dispatched.');
        console.log('  Message SID:', result.providerMessageId);

        if (resolvedAlpha) {
            console.log(`\n  ✓ Tenant sender "${tenantName}" was sanitised to "${resolvedAlpha}".`);
            console.log('    Recipients see this as the sender name (not a phone number).');
            console.log('    This matches the production behaviour when senderName is passed to SmsNotification.');
        } else if (alphaId) {
            console.log(`\n  ✓ System alpha sender "${alphaId}" was used (TWILIO_ALPHA_SENDER env var).`);
        } else {
            console.log(`\n  ✓ Sent from phone number ${fromNumber}.`);
        }
    } else {
        console.error('\n✗ Failed to send SMS:', result.error);

        if (effectiveSender && !effectiveSender.startsWith('+')) {
            console.log('\nTip: Alphanumeric Sender IDs are not supported in all countries (e.g. US).');
            console.log('     Check: https://help.twilio.com/articles/223133767');
        } else {
            console.log('\nTip: On a Twilio Trial account the recipient number must be verified.');
            console.log('     Go to: Twilio Console → Phone Numbers → Verified Caller IDs');
        }
    }
}

main().catch(console.error);
