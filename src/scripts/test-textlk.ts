/**
 * Text.lk Outbound SMS — Test Script
 *
 * Verifies Text.lk API credentials and tests alphanumeric sender IDs.
 *
 * Usage:
 *   npx tsx src/scripts/test-textlk.ts <RECIPIENT_NUMBER> [TENANT_NAME]
 *
 * Examples:
 *   npx tsx src/scripts/test-textlk.ts 94771234567
 *   npx tsx src/scripts/test-textlk.ts 94771234567 "TechSchool"
 */
import 'dotenv/config';
import { TextLkSmsProvider } from '../modules/Notification/infrastructure/sms/TextLkSmsProvider.js';
import { buildAlphaSenderId } from '../modules/Notification/application/services/SmsNotificationService.js';

async function main() {
    const apiToken = process.env.TEXT_LK_API_TOKEN ?? '';
    const defaultSenderId = process.env.TEXT_LK_SENDER_ID ?? '';

    // CLI args
    const recipient = process.argv[2] ?? '';
    const tenantName = process.argv[3] ?? ''; // optional: simulate a specific tenant's name

    // Resolve effective sender — same priority as production:
    //   1. Tenant name supplied on CLI (simulates caller-supplied senderName)
    //   2. TEXT_LK_SENDER_ID env var (system-level default)
    const resolvedAlpha = tenantName ? buildAlphaSenderId(tenantName) : undefined;
    const effectiveSender = resolvedAlpha || defaultSenderId.trim();

    console.log('\n=== Text.lk Outbound SMS — Test Script ===');
    console.log(`  API Token        : ${apiToken ? 'Configured ✓' : 'MISSING ✗'}`);
    console.log(`  Default Sender ID: ${defaultSenderId || '(not set)'}`);

    if (tenantName) {
        console.log(`  CLI Tenant Name  : "${tenantName}" → sanitised alpha ID: "${resolvedAlpha ?? '(invalid — see rules below)'}"`);
    }

    console.log(`  Effective From   : ${effectiveSender || 'NONE — no sender configured!'}`);

    if (!apiToken) {
        console.error('\n✗ TEXT_LK_API_TOKEN is required in your .env file.');
        process.exit(1);
    }

    if (!effectiveSender) {
        console.error('\n✗ No sender ID configured. Set at least one of:');
        console.error('    TEXT_LK_SENDER_ID    (default sender ID, env var)');
        console.error('    Pass a tenant name as the 2nd CLI argument');
        process.exit(1);
    }

    if (!recipient) {
        console.log('\nUsage:');
        console.log('  npx tsx src/scripts/test-textlk.ts <RECIPIENT_NUMBER> [TENANT_NAME]');
        console.log('\nExamples:');
        console.log('  npx tsx src/scripts/test-textlk.ts 94771234567');
        console.log('  npx tsx src/scripts/test-textlk.ts 94771234567 "TechSchool"');
        console.log('\nAlphanumeric Sender ID rules:');
        console.log('  • Max 11 characters (letters & digits only — spaces and symbols stripped)');
        console.log('  • One-way only — recipients cannot reply');
        process.exit(1);
    }

    const provider = new TextLkSmsProvider({
        apiToken,
        defaultSenderId: resolvedAlpha || defaultSenderId,
    });

    console.log(`\nSending test SMS to ${recipient} from "${effectiveSender}"...`);
    const result = await provider.sendSms(
        recipient,
        `Hello from DSMS! Sent from "${effectiveSender}" via Text.lk. Credentials verified ✓`,
        undefined,
        resolvedAlpha
    );

    if (result.success) {
        console.log('\n✓ Success! Message dispatched.');
        console.log('  Message Reference / UID:', result.providerMessageId);

        if (resolvedAlpha) {
            console.log(`\n  ✓ Tenant sender "${tenantName}" was sanitised to "${resolvedAlpha}".`);
            console.log('    Recipients see this as the sender name (not a phone number).');
            console.log('    This matches the production behaviour when senderName is passed to SmsNotification.');
        } else {
            console.log(`\n  ✓ System default sender "${defaultSenderId}" was used.`);
        }
    } else {
        console.error('\n✗ Failed to send SMS:', result.error);
        console.log('\nTip: Make sure the API Token is valid and your account balance is sufficient.');
    }
}

main().catch(console.error);
