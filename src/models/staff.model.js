const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const { private } = require("./plugins");
const { ROLE_TYPES, SCHEMA_NAME, GENDER_TYPES } = require("../const/constant");

const staffSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: [ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee],
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
    address: {
      pincode: {
        type: Number,
        default: "",
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
      enum: [GENDER_TYPES.male, GENDER_TYPES.female, GENDER_TYPES.transgender],
    },
    picture: {
      type: String,
      default: "https://i.imgur.com/CR1iy7U.png",
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

staffSchema.plugin(private);

/**
 *
 * @param {string} email - to check mail id present or not
 * @param {ObjectId} excludeUserId  - exclude given user ObjectId
 * @returns {<true/false>}
 */
staffSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  // this : represent Model { Staff }
  const filter = { email, _id: { $ne: excludeUserId }, isDeleted: false };
  const user = await this.findOne(filter);

  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
staffSchema.methods.isPasswordMatch = async function (password) {
  const staff = this;

  return bcrypt.compare(password, staff.password);
};

staffSchema.pre("save", async function (next) {
  const staff = this;
  if (staff.isModified("password")) {
    staff.password = await bcrypt.hash(staff.password, 8);
  }
  next();
});

/**
 * @typedef Staff
 */
const Staff = mongoose.model(SCHEMA_NAME.staff, staffSchema);

module.exports = Staff;
