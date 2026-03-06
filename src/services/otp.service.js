const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { sendEmail } = require("./email.service");
const {
  getUserById,
  updateUserById,
  removeUserFields,
} = require("./user.service");
const {
  getStaffById,
  updateStaffById,
} = require("./staff.service");

const sendVerificationOTP = async (to) => {
  const subject = "PG_Stay: Verify Your Identity";
  const otp = generateOTP();
  const currentYear = new Date().getFullYear();
  // Professional Responsive Template
  const text = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #127de0; margin: 0;">PG_Stay</h1>
        <p style="color: #666; font-size: 14px;">Your Premium Stay Partner</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; text-align: center;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
        <p style="color: #555; font-size: 16px;">Please use the following One-Time Password (OTP) to complete your verification. This code is valid for <b>2 minutes</b>.</p>
        
        <div style="margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #127de0; background: #fff; padding: 10px 20px; border: 2px dashed #127de0; border-radius: 5px;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>&copy; ${currentYear} PG_Stay Inc. | All rights reserved.</p>
      </div>
    </div>`;

  try {
    // Note: If your sendEmail function expects plain text + HTML,
    // ensure you pass this as the html parameter.
    await sendEmail(to, subject, text);
    return otp;
  } catch (e) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Error while sending verification mail",
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
  // Try to get user first, then staff
  let account = await getUserById(userId);
  let isStaff = false;

  if (!account) {
    account = await getStaffById(userId);
    isStaff = true;
  }

  if (!account) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
  }

  const duration = checkDuration(account.otpGeneratedTime);

  if (otp !== account.otp)
    throw new ApiError(httpStatus.BAD_REQUEST, "Please Enter Valid OTP");

  if (duration > 120)
    throw new ApiError(httpStatus.BAD_REQUEST, "OTP Expired Generate New OTP ");

  // Update either user or staff based on account type
  if (isStaff) {
    await updateStaffById(userId, {
      isEmailVerified: true,
      otp: undefined,
      otpGeneratedTime: undefined,
    });
  } else {
    await updateUserById(userId, {
      isEmailVerified: true,
      otp: undefined,
      otpGeneratedTime: undefined,
    });
  }

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
