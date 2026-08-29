const config = require("../config/config");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const { Resend } = require("resend");

const resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;

/**
 * @param {string} to
 * @param {string} token
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = "StaySync: Reset Your Password";
  // Use FRONTEND_URL for email links (must point to the React frontend, not the backend)
  const frontendUrl = config.frontendUrl || config.siteUrl || 'http://localhost:5173';
  const resetPasswordUrl = `${frontendUrl}/reset-password?token=${token}`;

  const text = `<html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <p>Dear User,</p>
      <p>To reset your password, click on the link below:</p>
      <p><a href="${resetPasswordUrl}" style="color: #6366f1; font-weight: bold;">Reset Password</a></p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <br/>
      <p style="color: #999; font-size: 12px;">— Team StaySync</p>
    </body>
  </html>`;

  await sendEmail(to, subject, text);
};

const sendEmail = async (to, subject, text) => {
  let from = config.email.from || "test@prathmeshjadhav.com";
  // Format display name as "StaySync PG Management <email>" so clients render professional sender name
  if (!from.includes("<")) {
    from = `StaySync PG Management <${from}>`;
  }

  switch (config.email.provider) {
    case "resend": {
      if (!resend) {
        throw new Error("Resend API key is missing in configuration");
      }
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html: text,
      });

      if (error) {
        logger.error(`Resend email dispatch error: ${JSON.stringify(error)}`);
        throw new Error(error.message || "Failed to send email via Resend");
      }

      logger.info(`Email sent via Resend successfully. ID: ${data?.id}`);
      return data;
    }

    case "sendgrid":
      // to be implemented.
      break;

    case "gmail":
    case "smtp":
    default: {
      const msg = {
        from: from.includes("<") ? from : `StaySync PG Management <${from}>`,
        to,
        subject,
        html: text,
      };
      await transport.sendMail(msg);
      break;
    }
  }
};

const transport = (function () {
  switch (config.email.provider) {
    case "resend":
      return null;

    case "sendgrid":
      throw new Error("sendGrid Mailer not supported");

    case "aws":
      // To be implemented later. Use smtp for development
      throw new Error("AWS Mailer not supported");

    case "gmail":
      const mailTransporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,       // false = STARTTLS (upgrades to TLS after handshake)
        requireTLS: true,    // force TLS upgrade, reject plain connections
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth: {
          user: config.gmail.auth.user,
          pass: config.gmail.auth.pass,
        },
        logger: false,
        debug: false,
      });

      if (config.env !== "test") {
        mailTransporter.verify()
          .then(() => logger.info("Gmail SMTP connected successfully via port 587 STARTTLS"))
          .catch((err) => logger.error(`Gmail SMTP connection FAILED: ${err.message} | Check GMAIL_USERNAME and GMAIL_PASSWORD (must be a Google App Password, not your regular Gmail password)`));
      }

      return mailTransporter;

    case "smtp":
    default:
      const tp = nodemailer.createTransport({
        ...config.email.smtp,
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
      if (config.env !== "test") {
        tp.verify()
          .then(() =>
            logger.info(
              `Connected to email server => ${config.email.smtp.host}`
            )
          )
          .catch((err) =>
            logger.warn(
              `Unable to connect to email server (${err.message}). Make sure you have correctly configured the SMTP options in .env`
            )
          );
      }
      return tp;
  }
})();

const sendVerificationEmail = async (to, token) => {
  const subject = "Verify Your Email";
  // Use FRONTEND_URL for email links (must point to the React frontend, not the backend)
  const frontendUrl = config.frontendUrl || config.siteUrl || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  const text = `<html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <p>Dear User,</p>
      <p>To verify your email address, click on the link below:</p>
      <p><a href="${verificationUrl}" style="color: #6c63ff; font-weight: bold;">Verify Email</a></p>
      <p>If you did not request email verification, please ignore this email.</p>
      <br/>
      <p style="color: #999; font-size: 12px;">— Team PG Stay</p>
    </body>
  </html>`;

  await sendEmail(to, subject, text);
};

module.exports = {
  sendResetPasswordEmail,
  sendVerificationEmail,
  sendEmail,
};
