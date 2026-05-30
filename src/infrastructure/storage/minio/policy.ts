export const buildPublicReadBucketPolicy = (bucketName: string): string => {
    return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Sid: `PublicRead${bucketName}`,
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
        ],
    });
};