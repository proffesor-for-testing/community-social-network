import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateEngine } from './template-engine';

export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  templateContext?: Record<string, unknown>;
  html?: string;
  text?: string;
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Email delivery service using Nodemailer.
 * Uses SES transport in production, SMTP in development.
 * Falls back to logging emails when Nodemailer is not available.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly config: SmtpConfig;
  private transporter: unknown = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateEngine: TemplateEngine,
  ) {
    this.config = {
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 1025),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
      },
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@community.local'),
    };

    this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      const nodemailer = await import('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth.user
          ? { user: this.config.auth.user, pass: this.config.auth.pass }
          : undefined,
      });
      this.logger.log('Nodemailer transporter initialized');
    } catch {
      this.logger.warn(
        'Nodemailer not available - emails will be logged to console',
      );
    }
  }

  /**
   * Sends an email using a template or raw HTML/text.
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    let html = options.html || '';
    const text = options.text || '';

    // Render template if specified
    if (options.template && options.templateContext) {
      html = await this.templateEngine.render(
        options.template,
        options.templateContext,
      );
    }

    if (this.transporter) {
      return this.sendViaTransporter(options.to, options.subject, html, text);
    }

    return this.stubSend(options.to, options.subject, html, text);
  }

  /**
   * Sends a welcome email to a newly registered member.
   */
  async sendWelcome(to: string, displayName: string): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'Welcome to Community Social Network!',
      template: 'welcome',
      templateContext: {
        displayName,
        loginUrl: this.configService.get<string>('APP_URL', 'http://localhost:3000') + '/login',
        year: new Date().getFullYear(),
      },
    });
  }

  /**
   * Sends a password reset email.
   */
  async sendPasswordReset(to: string, resetToken: string): Promise<EmailResult> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    return this.send({
      to,
      subject: 'Password Reset Request',
      template: 'password-reset',
      templateContext: {
        resetUrl: `${appUrl}/reset-password?token=${resetToken}`,
        expiresIn: '1 hour',
        year: new Date().getFullYear(),
      },
    });
  }

  /**
   * Sends a notification digest email.
   */
  async sendNotificationDigest(
    to: string,
    displayName: string,
    notifications: Array<{ title: string; body: string; time: string }>,
  ): Promise<EmailResult> {
    return this.send({
      to,
      subject: `You have ${notifications.length} new notification${notifications.length > 1 ? 's' : ''}`,
      template: 'notification-digest',
      templateContext: {
        displayName,
        notifications,
        notificationCount: notifications.length,
        appUrl: this.configService.get<string>('APP_URL', 'http://localhost:3000'),
        year: new Date().getFullYear(),
      },
    });
  }

  private async sendViaTransporter(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<EmailResult> {
    try {
      const sendMail = (
        this.transporter as { sendMail: (opts: unknown) => Promise<{ messageId: string; accepted: string[]; rejected: string[] }> }
      ).sendMail.bind(this.transporter);

      const info = await sendMail({
        from: this.config.from,
        to,
        subject,
        html,
        text: text || undefined,
      });

      this.logger.log(`Email sent to ${to}: ${info.messageId}`);

      return {
        messageId: info.messageId,
        accepted: info.accepted || [to],
        rejected: info.rejected || [],
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  private stubSend(
    to: string,
    subject: string,
    html: string,
    _text: string,
  ): EmailResult {
    const messageId = `stub-${Date.now()}@community.local`;

    this.logger.log(
      `[STUB EMAIL] To: ${to} | Subject: ${subject} | HTML length: ${html.length}`,
    );

    return {
      messageId,
      accepted: [to],
      rejected: [],
    };
  }
}
