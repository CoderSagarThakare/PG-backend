const config = require("../config/config");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");

/**
 *
 * @param {string} to
 * @param {string} token
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = "Reset the password";
  // replace this url with the link to the reset password page of your front-end app
  const resetPasswordUrl = `${config.siteUrl}/auth/reset-password?token=${token}`;

  const text = `<HTML>Dear User,</br>
  To reset your password, click on the link  <a href=${resetPasswordUrl} >Verify Account </a> </br> 
  If you did not request any password reset, then ignore this email.</br>
  
  Beta version : need to update proper siteurl of server</HTML>`;

  await sendEmail(to, subject, text);
};

const sendEmail = async (to, subject, text) => {
  const msg = {
    from: `Admin@Marathi-Coders <${config.gmail.auth.user}>`,
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
        service: config.email.provider,
        auth: {
          user: config.gmail.auth.user,
          pass: config.gmail.auth.pass,
        },
      });

      return mailTransporter;

    case "smtp":
    default:
      const tp = nodemailer.createTransport(config.email.smtp);
      if (config.env !== "test") {
        tp.verify()
          .then(() =>
            logger.info(
              `Connected to email server => ${config.email.smtp.host}`
            )
          )
          .catch(() =>
            logger.warn(
              "Unable to connect to email server. Make sure you have correctly configured the SMTP options in .env"
            )
          );
      }
      return tp;
  }
})();

const sendVerificationEmail = async (to, token) => {
  const subject = "Email Verification";
  // replace this url with the link to the email verification page of your front-end app
  const verificationUrl = `${config.siteUrl}/auth/verify-email?token=${token}`;
  const text = `<html>Dear user,<br>
  To verify your email click on given link <a href=${verificationUrl}>Verify the Email </a><br>
  If you did not send request for verify email, then ignore this email.</br>
  
  Beta version : need to update proper siteurl of server <html>`;

  await sendEmail(to, subject, text);
};

module.exports = {
  sendResetPasswordEmail,
  sendVerificationEmail,
  sendEmail,
};
