const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const enquirySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
      index: true,
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.post,
      required: true,
    },
    // Denormalized for fast access control & filtering
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "interested", // Default: User clicks "Show Interest"
        "contacted", // User clicks "Call" or "WhatsApp"
        "visited", // User visited the PG (Tracked via Visit Link/Geo)
        "dealDone", // Owner onboarded the user
        "rejected", // User not interested or Owner rejected
        "inventoryFull", // Auto-rejected because PG beds are full
      ],
      default: "interested",
    },
    // For manual notes by Owner/Manager during the lead process
    staffRemarks: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    userRemark: {
      type: String,
      trim: true,
      maxLength: 300, // Zyada bada nahi, bas chota note
    },
    // To track who moved the lead to the final stage
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
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

// --- INDEXING ---
// 1. Ek user ek hi vacancy post par baar-baar enquiry na kare (Spam Control)
enquirySchema.index({ userId: 1, postId: 1 }, { unique: true });

// 2. Query optimization for Owner/Manager dashboards
enquirySchema.index({ ownerId: 1, status: 1 });
enquirySchema.index({ managerId: 1, status: 1 });

// --- MIDDLEWARE ---
// Soft delete filter automatically 
enquirySchema.pre(/^find/, function (next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Enquiry = mongoose.model(SCHEMA_NAME.enquiry, enquirySchema);

module.exports = Enquiry;
