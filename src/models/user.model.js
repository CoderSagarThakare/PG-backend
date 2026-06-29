const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const { private } = require("./plugins");
const { SCHEMA_NAME, ROLE_TYPES, GENDER_TYPES } = require("../const/constant");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: [ROLE_TYPES.user, ROLE_TYPES.admin, ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email");
        }
      },
    },
    // /\d/ : if the input string contains at least one digit (0-9) will evaluate/return to true.
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error(
            "Password must contain at least one letter and one number",
          );
        }
      },
      private: true, // used by the private plugin
    },
    mobNo1: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please provide a valid 10-digit mobile number"],
    },
    mobNo2: {
      type: String,
      trim: true,
      validate(value) {
        if (value && !value.match(/^[6-9]\d{9}$/)) {
          throw new Error("Please provide a valid 10-digit mobile number");
        }
      },
      default: null,
    },
    address: {
      pincode: {
        type: Number,
        default: null,
      },
      locationDescription: {
        type: String,
        default: "",
        trim: true,
      },
      landmark: {
        type: String,
        default: "",
        trim: true,
      },
      city: {
        default: "",
        type: String,
        trim: true,
      },
      state: {
        type: String,
        default: "",
        trim: true,
      },
      country: {
        type: String,
        default: "India",
        trim: true,
      },
    },
    gender: {
      type: String,
      enum: [GENDER_TYPES.male, GENDER_TYPES.female, GENDER_TYPES.transgender, GENDER_TYPES.preferNotToSay],
    },
    picture: {
      type: String,
      default: "https://i.imgur.com/CR1iy7U.png",
    },
    profileImageKey: {
      type: String,
      default: null, // S3 object key, null means using default picture
    },
    aadharNumber: {
      type: String,
      trim: true,
      validate(value) {
        if (value && !value.match(/^\d{12}$/)) {
          throw new Error("Please provide a valid 12-digit Aadhaar number");
        }
      },
      default: null,
    },
    aadharFileKey: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPasswordUpdated: {
      type: Boolean,
      default: true,
    },
    otp: {
      type: Number,
      default: -1,
    },
    otpGeneratedTime: { type: String, default: undefined },
    vehicleType: {
      type: String,
      enum: ["none", "bike", "car"],
      default: "none",
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.plugin(private);

/**
 *
 * @param {string} email - to check mail id present or not
 * @param {ObjectId} excludeUserId  - exclude given user ObjectId
 * @returns {<true/false>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  // this : represent Model { User }
  const filter = { email, _id: { $ne: excludeUserId }, isDeleted: false };
  const user = await this.findOne(filter);

  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;

  return bcrypt.compare(password, user.password);
};

userSchema.pre("save", async function (next) {
  const user = this;
  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

/**
 * @typedef User
 */
const User = mongoose.model(SCHEMA_NAME.user, userSchema);

module.exports = User;

/**
 * When fetching a user from the database, this plugin ensures that the password field is excluded from the output.
 * It helps maintain data privacy and security by not exposing sensitive information.
 */
