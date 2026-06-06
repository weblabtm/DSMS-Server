import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const BASE_URL = 'http://localhost:3000';

function parseArgs() {
    const args = process.argv.slice(2);
    let email: string | undefined;
    let phoneNumber: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--email' && args[i + 1]) {
            email = args[i + 1];
            i++;
        } else if ((args[i] === '--phone' || args[i] === '--phoneNumber') && args[i + 1]) {
            phoneNumber = args[i + 1];
            i++;
        }
    }

    return { email, phoneNumber };
}

async function run() {
    const rl = readline.createInterface({ input, output });

    try {
        console.log('\n=============================================');
        console.log('           OTP Flow CLI Test Script          ');
        console.log('=============================================\n');
        console.log(`Target Server: ${BASE_URL}`);
        console.log('Note: Ensure DISABLE_CAPTCHA=true is set in your .env file to bypass Google Captcha checking.');
        console.log('--------------------------------------------------------------------------------------\n');

        const parsed = parseArgs();
        let email = parsed.email || '';
        let phoneNumber = parsed.phoneNumber || '';

        if (!email && !phoneNumber) {
            email = await rl.question('Enter recipient Email (press Enter to skip): ');
            phoneNumber = await rl.question('Enter recipient Phone Number (press Enter to skip): ');
        } else {
            console.log(`Using flags - Email: "${email || '(none)'}", Phone: "${phoneNumber || '(none)'}"`);
        }

        if (!email.trim() && !phoneNumber.trim()) {
            console.error('\nError: You must provide at least an email or a phone number.');
            return;
        }

        let validated = false;
        while (!validated) {
            console.log('\nSending generate OTP request...');
            const generateResponse = await fetch(`${BASE_URL}/auth/otp/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim() || undefined,
                    phoneNumber: phoneNumber.trim() || undefined,
                    captchaToken: 'test-bypass-token' // Will be accepted if DISABLE_CAPTCHA=true
                }),
            });

            const generateData = await generateResponse.json() as any;

            if (!generateResponse.ok) {
                console.error('\n❌ Failed to generate OTP:', generateData);
                return;
            }

            console.log('\n✅ Generate OTP Success!');
            console.log('Response body:', generateData);

            // Capture set-cookie header
            const setCookie = generateResponse.headers.get('set-cookie');
            const token = generateData.token;

            console.log('\n---------------------------------------------');
            console.log('Please check your email/SMS log/console for the 6-digit OTP.');
            const otpCode = await rl.question('Enter the 6-digit OTP code (or type "exit" to quit): ');
            console.log('---------------------------------------------\n');

            if (otpCode.trim().toLowerCase() === 'exit') {
                console.log('Exiting OTP validation loop.');
                break;
            }

            console.log('Sending validation request...');
            
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Forward the cookie token if it was set
            if (setCookie) {
                const match = setCookie.match(/otp_token=([^;]+)/);
                if (match) {
                    headers['Cookie'] = `otp_token=${match[1]}`;
                }
            }

            const validateResponse = await fetch(`${BASE_URL}/auth/otp/validate`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    otp: otpCode.trim(),
                    token: token // Fallback body token
                }),
            });

            const validateData = await validateResponse.json() as any;

            if (validateResponse.ok) {
                console.log('\n🎉 SUCCESS: OTP is valid!');
                console.log('Response:', validateData);
                validated = true;
            } else {
                console.log('\n❌ FAILED: Verification failed.');
                console.log('Response:', validateData);
                console.log('\nSince OTPs are single-use and destroyed on any check, generating a new one for you...');
            }
        }

    } catch (error) {
        console.error('\n❌ An error occurred during test execution:', error);
    } finally {
        rl.close();
    }
}

run();
