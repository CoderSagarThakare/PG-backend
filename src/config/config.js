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
    AWS_REGION: Joi.string().required().description("AWS Region"),
    AWS_ACCESS_KEY_ID: Joi.string().required().description("AWS Access Key ID"),
    AWS_SECRET_ACCESS_KEY: Joi.string().required().description("AWS Secret Access Key"),
    AWS_S3_BUCKET_NAME: Joi.string().required().description("AWS S3 Bucket Name"),
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
  frontendUrl: envVars.FRONTEND_URL || envVars.SITE_URL || 'http://localhost:5173',
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES || 15,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS || 7,
    resetPasswordExpirationMinutes:
      envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === "test" ? "-test" : ""),
    options: {},
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
  aws: {
    s3: {
      region: envVars.AWS_REGION,
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
      bucketName: envVars.AWS_S3_BUCKET_NAME,
    },
  },
};
