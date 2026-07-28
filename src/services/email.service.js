const config = require("../config/config");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");

/**
 *
 * @param {string} to
 * @param {string} token
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = "Reset Your Password";
  // Use FRONTEND_URL for email links (must point to the React frontend, not the backend)
  const frontendUrl = config.frontendUrl || config.siteUrl || 'http://localhost:5173';
  const resetPasswordUrl = `${frontendUrl}/reset-password?token=${token}`;

  const text = `<html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <p>Dear User,</p>
      <p>To reset your password, click on the link below:</p>
      <p><a href="${resetPasswordUrl}" style="color: #6c63ff; font-weight: bold;">Reset Password</a></p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <br/>
      <p style="color: #999; font-size: 12px;">— Team PG Stay</p>
    </body>
  </html>`;

  await sendEmail(to, subject, text);
};

const sendEmail = async (to, subject, text) => {
  const msg = {
    from: `Admin@PG_Stay <${config.gmail.auth.user}>`,
    to,
    subject,
    html: text,
  };

  switch (config.email.provider) {
    case "sendgrid":
      // to be implemented.
      break;

    case "gmail":
      await transport.sendMail(msg);
      break;

    case "smtp":
    default:
      await transport.sendMail(msg);
      break;
  }
};

const transport = (function () {
  switch (config.email.provider) {
    case "sendgrid":
      throw new Error("sendGrid Mailer not supported");

    case "aws":
      // To be implemented later. Use smtp for development
      throw new Error("AWS Mailer not supported");

    case "gmail":
      const mailTransporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: config.gmail.auth.user,
          pass: config.gmail.auth.pass,
        },
      });

      return mailTransporter;

    case "smtp":
    default:
      const tp = nodemailer.createTransport({
        ...config.email.smtp,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
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
