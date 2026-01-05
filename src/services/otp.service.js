const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { sendEmail } = require("./email.service");
const {
  getUserById,
  updateUserById,
  removeUserFields,
} = require("./user.service");

const sendVerificationOTP = async (to) => {
  const subject = "OTP Verification";
  const otp = generateOTP();
  const text = `<html>
                    <h2>Please Confirm your OTP</h2>
                    <h3>Your OTP code is : <h1 style="color : #127de0">${otp}</h1> </h3></br>
                    <p>If you did not send request for OTP verification, then ignore this email. </p>
                </html>`;

  try {
    await sendEmail(to, subject, text);

    return otp;
  } catch (e) {
    throw new ApiError("Error while sending mail");
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
  const user = await getUserById(userId);

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
  }

  const duration = checkDuration(user.otpGeneratedTime);

  if (otp !== user.otp)
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
