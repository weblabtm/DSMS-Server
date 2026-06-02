import crypto from 'node:crypto';

export function isValidTwilioSignature(
    authToken: string,
    signature: string | undefined,
    url: string,
    params: Record<string, any>
): boolean {
    if (!signature) return false;

    // 1. Sort parameter keys alphabetically
    const sortedKeys = Object.keys(params).sort();

    // 2. Concatenate URL and sorted params
    let data = url;
    for (const key of sortedKeys) {
        data += key + (params[key] ?? '');
    }

    // 3. Compute HMAC-SHA1
    const hmac = crypto.createHmac('sha1', authToken);
    hmac.update(data);
    const computedSignature = hmac.digest('base64');

    // 4. Compare signatures securely
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'base64'),
            Buffer.from(computedSignature, 'base64')
        );
    } catch {
        return false;
    }
}
