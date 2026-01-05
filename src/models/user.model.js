const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const { private } = require("./plugins");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
            "Password must contain at least one letter and one number"
          );
        }
      },
      private: true, // used by the private plugin
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
  },
  {
    timestamps: true,
  }
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
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });

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
const User = mongoose.model("User", userSchema);

module.exports = User;

/**
 * When fetching a user from the database, this plugin ensures that the password field is excluded from the output.
 * It helps maintain data privacy and security by not exposing sensitive information.
 */
