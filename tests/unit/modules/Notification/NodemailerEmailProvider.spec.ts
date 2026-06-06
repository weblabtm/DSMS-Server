import { describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { NodemailerEmailProvider } from '../../../../src/modules/Notification/infrastructure/email/NodemailerEmailProvider.js';

vi.mock('nodemailer', () => {
    const mockTransporter = {
        sendMail: vi.fn(),
    };
    return {
        default: {
            createTransport: vi.fn().mockReturnValue(mockTransporter),
        },
    };
});

describe('NodemailerEmailProvider', () => {
    it('creates nodemailer transport and successfully sends an email', async () => {
        const mockTransporter = nodemailer.createTransport() as any;
        mockTransporter.sendMail.mockResolvedValue({
            messageId: 'mock-msg-id-123',
        });

        const provider = new NodemailerEmailProvider({
            host: 'smtp.mailtrap.io',
            port: 2525,
            secure: false,
            auth: {
                user: 'username',
                pass: 'password',
            },
            fromEmail: 'sender@example.com',
            fromName: 'Test Brand',
        });

        const result = await provider.sendEmail('recipient@example.com', 'Test Subject', '<h1>Test Body</h1>');

        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            host: 'smtp.mailtrap.io',
            port: 2525,
            secure: false,
            auth: {
                user: 'username',
                pass: 'password',
            },
        });

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: '"Test Brand" <sender@example.com>',
            to: 'recipient@example.com',
            subject: 'Test Subject',
            html: '<h1>Test Body</h1>',
        });

        expect(result).toEqual({
            success: true,
            providerMessageId: 'mock-msg-id-123',
        });
    });

    it('returns error result when configuration properties are missing', async () => {
        const provider = new NodemailerEmailProvider({
            host: '',
            port: 587,
            secure: false,
            fromEmail: '',
        });

        const result = await provider.sendEmail('recipient@example.com', 'Test Subject', '<h1>Test Body</h1>');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Nodemailer is not properly configured');
    });

    it('returns error result when sendMail throws an error', async () => {
        const mockTransporter = nodemailer.createTransport() as any;
        mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Connection Timeout'));

        const provider = new NodemailerEmailProvider({
            host: 'smtp.example.com',
            port: 465,
            secure: true,
            fromEmail: 'sender@example.com',
        });

        const result = await provider.sendEmail('recipient@example.com', 'Test Subject', '<h1>Test Body</h1>');

        expect(result).toEqual({
            success: false,
            error: 'SMTP Connection Timeout',
        });
    });
});
