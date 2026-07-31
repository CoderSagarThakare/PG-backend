const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { sendEmail } = require("./email.service");
const {
  getUserById,
  updateUserById,
  removeUserFields,
} = require("./user.service");

const sendVerificationOTP = async (to) => {
  const subject = "StaySync: Verify Your Email Address";
  const otp = generateOTP();
  const currentYear = new Date().getFullYear();
  // Professional Responsive Template
  const text = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">StaySync</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px; font-weight: 500;">Smart & Seamless PG Property Management</p>
      </div>
      
      <div style="background-color: #f8fafc; padding: 32px 24px; border-radius: 10px; text-align: center; border: 1px solid #f1f5f9;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">Verify Your Email Address</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">Please use the following One-Time Password (OTP) to complete your account verification. This code expires in <b>2 minutes</b>.</p>
        
        <div style="margin: 28px 0;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #6366f1; background: #ffffff; padding: 12px 28px; border: 2px dashed #6366f1; border-radius: 8px; display: inline-block;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this verification code, please ignore this email.</p>
      </div>
      
      <div style="margin-top: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
        <p style="margin: 0;">&copy; ${currentYear} StaySync PG Management. All rights reserved.</p>
      </div>
    </div>`;

  try {
    // Note: If your sendEmail function expects plain text + HTML,
    // ensure you pass this as the html parameter.
    await sendEmail(to, subject, text);
    return otp;
  } catch (e) {
    logger.error("Failed to send verification email:", e);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to send verification email (${e.message || 'Email service error'}). Please check server SMTP credentials.`,
    );
  }
};

// generate otp with dynamic length
// if generated value is less than base value then we will add this basevalue to our generated value

const generateOTP = (length = 6) => {
  const baseValue = Math.pow(10, length - 1);
  let generatedNo = Math.floor(Math.random() * Math.pow(10, length));

  return generatedNo < baseValue ? (generatedNo += baseValue) : generatedNo;
};

// validate otp coming from frontned
const validateOTP = async (userId, otp) => {
  let account = await getUserById(userId);

  if (!account) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
  }

  const duration = checkDuration(account.otpGeneratedTime);

  if (otp !== account.otp)
    throw new ApiError(httpStatus.BAD_REQUEST, "Please Enter Valid OTP");

  if (duration > 120)
    throw new ApiError(httpStatus.BAD_REQUEST, "OTP Expired Generate New OTP ");

  await updateUserById(userId, {
    isEmailVerified: true,
    otp: undefined,
    otpGeneratedTime: undefined,
  });

  return true;
};

function checkDuration(otpGeneratedTime) {
  var currentTime = new Date();
  otpGeneratedTime = new Date(otpGeneratedTime);

  const duration = (currentTime.getTime() - otpGeneratedTime.getTime()) / 1000;

  return duration;
}

module.exports = {
  sendVerificationOTP,
  validateOTP,
};
