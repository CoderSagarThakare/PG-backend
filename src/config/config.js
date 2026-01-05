require("dotenv").config();
const Joi = require("joi");

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid("production", "development", "test")
      .required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description("Mongo DB url"),
    JWT_SECRET: Joi.string().required().description("JWT secret key"),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which reset password token expires"),
  })
  .unknown();

//Using Joi.unknown() in this way allows you to handle situations where some properties are optional or may not be known in advance,
//  making your validation more flexible.

// prefs :Set the default label for error messages (default: 'key')
const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  siteUrl: envVars.SITE_URL,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    resetPasswordExpirationMinutes:
      envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === "test" ? "-test" : ""),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  socialLogin: {
    google: {
      clientId: envVars.GOOGLE_CLIENT_ID,
    },
    facebook: {
      clientId: envVars.FACEBOOK_APP_ID,
    },
  },
  email: {
    provider: envVars.EMAIL_PROVIDER, //// sendgrid, aws, nodemailer
    key: envVars.EMAIL_PROVIDER_KEY, // For sendgrid and aws
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  gmail: {
    auth: {
      user: envVars.GMAIL_USERNAME,
      pass: envVars.GMAIL_PASSWORD
    }
  },
};
