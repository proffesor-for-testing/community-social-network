/**
 * Email Service
 * Handles sending transactional emails (verification, password reset)
 */

import { AuthConfig, defaultAuthConfig } from './auth.types';

export interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

/**
 * Email provider interface for dependency injection
 */
export interface EmailProvider {
  send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export class TransactionalEmailService implements EmailService {
  private readonly provider: EmailProvider;
  private readonly config: AuthConfig;
  private readonly baseUrl: string;
  private readonly fromEmail: string;

  constructor(
    provider: EmailProvider,
    config: Partial<AuthConfig> = {},
    options?: {
      baseUrl?: string;
      fromEmail?: string;
    }
  ) {
    this.provider = provider;
    this.config = { ...defaultAuthConfig, ...config };
    this.baseUrl = options?.baseUrl || process.env.APP_BASE_URL || 'http://localhost:3000';
    this.fromEmail = options?.fromEmail || process.env.FROM_EMAIL || 'noreply@community-network.com';
  }

  /**
   * Send email verification email
   *
   * @param email - Recipient email address
   * @param token - Verification token
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const expiryHours = Math.floor(this.config.emailVerificationExpiry / 3600);

    await this.provider.send({
      to: email,
      subject: 'Verify your email address - Community Network',
      html: this.getVerificationEmailHtml(verificationUrl, expiryHours),
      text: this.getVerificationEmailText(verificationUrl, expiryHours),
    });
  }

  /**
   * Send password reset email
   *
   * @param email - Recipient email address
   * @param token - Reset token
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const expiryHours = Math.floor(this.config.passwordResetExpiry / 3600);

    await this.provider.send({
      to: email,
      subject: 'Reset your password - Community Network',
      html: this.getPasswordResetEmailHtml(resetUrl, expiryHours),
      text: this.getPasswordResetEmailText(resetUrl, expiryHours),
    });
  }

  private getVerificationEmailHtml(url: string, expiryHours: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to Community Network</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Thank you for registering! Please click the button below to verify your email address and activate your account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in ${expiryHours} hour${expiryHours !== 1 ? 's' : ''}.</p>
          <p style="color: #666; font-size: 14px;">If you did not create an account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${url}</p>
        </div>
      </body>
      </html>
    `;
  }

  private getVerificationEmailText(url: string, expiryHours: number): string {
    return `
Welcome to Community Network!

Please verify your email address by clicking the link below:

${url}

This link will expire in ${expiryHours} hour${expiryHours !== 1 ? 's' : ''}.

If you did not create an account, please ignore this email.
    `.trim();
  }

  private getPasswordResetEmailHtml(url: string, expiryHours: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Community Network</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in ${expiryHours} hour${expiryHours !== 1 ? 's' : ''}.</p>
          <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${url}</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailText(url: string, expiryHours: number): string {
    return `
Community Network - Password Reset

We received a request to reset your password. Click the link below to create a new password:

${url}

This link will expire in ${expiryHours} hour${expiryHours !== 1 ? 's' : ''}.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.
    `.trim();
  }
}

/**
 * Mock email service for testing
 */
export class MockEmailService implements EmailService {
  public sentEmails: Array<{
    type: 'verification' | 'password_reset';
    email: string;
    token: string;
    timestamp: Date;
  }> = [];

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    this.sentEmails.push({
      type: 'verification',
      email,
      token,
      timestamp: new Date(),
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    this.sentEmails.push({
      type: 'password_reset',
      email,
      token,
      timestamp: new Date(),
    });
  }

  // Helper methods for testing
  clear(): void {
    this.sentEmails = [];
  }

  getLastEmail(): (typeof this.sentEmails)[0] | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }
}

/**
 * Factory function to create an email service
 */
export function createEmailService(
  provider?: EmailProvider,
  config?: Partial<AuthConfig>,
  options?: { baseUrl?: string; fromEmail?: string }
): EmailService {
  if (provider) {
    return new TransactionalEmailService(provider, config, options);
  }
  return new MockEmailService();
}
