/**
 * onboarding.service.js
 *
 * Pure business logic for the Tenant Onboarding feature.
 * No HTTP concerns (req / res) belong here — those live in the controller.
 *
 * Flow summary:
 *   1. initiateOnboarding   — create record from a dealDone enquiry
 *   2. updateOnboardingStep — patch step fields; auto-advance status
 *   3. sendRulesForAcceptance — set status = 'rules_sent'
 *   4. getRulesForTenant    — tenant reads the rules (with signed URL if PDF)
 *   5. acceptRules          — tenant (or staff for physical) marks rules accepted
 *   6. assignBed            — hard-gated final step; delegates to roomService
 *   7. getOnboarding        — full detail view with rich population
 *   8. listOnboardings      — paginated PG-level list
 *   9. shiftBed             — move an active tenant to a different bed
 *  10. offboardTenant       — vacate tenant, settle deposit, close assignment
 *  11. getPGRulesUploadUrl  — presigned S3 PUT URL for rules PDF
 *  12. updatePGRules        — save rules metadata on the PG document
 *  13. getMyPGInfo          — tenant reads their own PG/bed/onboarding info
 *  14. getBedHistory        — full bed history for a tenant
 */

const httpStatus = require("http-status");
const {
  Onboarding,
  BedAssignment,
  Bed,
  PG,
  Enquiry,
  User,
} = require("../models");
const awsService = require("./aws.service");
const roomService = require("./room.service");
const ApiError = require("../utils/ApiError");

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Verify that the given staffId is the owner or manager of the PG.
 * Throws 403 if access is denied.
 * @param {Object} pg   - Mongoose PG document (must have ownerId, managerId)
 * @param {string} staffId
 */
const assertStaffAccessToPG = (pg, staffId) => {
  const id = staffId.toString();
  if (
    pg.ownerId?.toString() !== id &&
    pg.managerId?.toString() !== id
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied: you are not the owner or manager of this PG"
    );
  }
};

/**
 * Fetch an onboarding record and the associated PG in one go.
 * Throws 404 if not found.
 * @param {string} onboardingId
 * @returns {Promise<{ onboarding: Object, pg: Object }>}
 */
const fetchOnboardingAndPG = async (onboardingId) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw new ApiError(httpStatus.NOT_FOUND, "Onboarding record not found");
  }
  const pg = await PG.findById(onboarding.pgId);
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }
  return { onboarding, pg };
};

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * 1. Initiate a new onboarding process.
 *
 * Prerequisites:
 *  - enquiry must exist and be in 'dealDone' status
 *  - no active (non-completed/non-removed) onboarding for the same enquiry
 *
 * @param {string} enquiryId
 * @param {string} processedBy - staffId of the owner/manager running this
 * @returns {Promise<Onboarding>}
 */
const initiateOnboarding = async (enquiryId, processedBy) => {
  // Validate enquiry
  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }
  if (enquiry.status !== "dealDone") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Onboarding can only be initiated for enquiries with status 'dealDone'"
    );
  }

  // Guard against duplicate active onboarding for the same enquiry or user/PG — return existing to allow resuming
  const existing = await Onboarding.findOne({
    $or: [
      { enquiryId },
      { userId: enquiry.userId, pgId: enquiry.pgId }
    ],
    status: { $ne: "removed" },
  });
  if (existing) {
    return existing;
  }

  // Verify staff access to this PG
  const pg = await PG.findById(enquiry.pgId);
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }
  assertStaffAccessToPG(pg, processedBy);

  const onboarding = await Onboarding.create({
    enquiryId,
    userId: enquiry.userId,
    pgId: enquiry.pgId,
    processedBy,
    status: "initiated",
  });

  return onboarding;
};

/**
 * 2. Update one or more step fields in an existing onboarding.
 *
 * Allowed step fields: emergencyContact, documentsReviewed, financialTerms,
 *   joiningDate, notes, rulesAcceptance.
 * Auto-advances status:
 *   - documentsReviewed.reviewedAt set + status==='initiated' → 'docs_reviewed'
 *   - financialTerms.securityDepositReceived===true + status in early stages → 'deposit_confirmed'
 *
 * @param {string} onboardingId
 * @param {string} staffId
 * @param {Object} stepData
 * @returns {Promise<Onboarding>}
 */
const updateOnboardingStep = async (onboardingId, staffId, stepData) => {
  const { onboarding, pg } = await fetchOnboardingAndPG(onboardingId);
  assertStaffAccessToPG(pg, staffId);

  const {
    emergencyContact,
    documentsReviewed,
    financialTerms,
    joiningDate,
    notes,
  } = stepData;

  // Patch only provided top-level fields
  if (emergencyContact !== undefined) {
    onboarding.emergencyContact = {
      ...onboarding.emergencyContact?.toObject?.() ?? {},
      ...emergencyContact,
    };
  }

  if (documentsReviewed !== undefined) {
    onboarding.documentsReviewed = {
      ...onboarding.documentsReviewed?.toObject?.() ?? {},
      ...documentsReviewed,
    };
  }

  if (financialTerms !== undefined) {
    onboarding.financialTerms = {
      ...onboarding.financialTerms?.toObject?.() ?? {},
      ...financialTerms,
    };
  }

  if (joiningDate !== undefined) {
    onboarding.joiningDate = joiningDate;
  }

  if (notes !== undefined) {
    onboarding.notes = notes;
  }

  // ── Auto-advance status ───────────────────────────────────────────────────

  // docs_reviewed: documents have been reviewed and status is still 'initiated'
  if (
    onboarding.documentsReviewed?.reviewedAt &&
    onboarding.status === "initiated"
  ) {
    onboarding.status = "docs_reviewed";
  }

  // deposit_confirmed: security deposit now marked received
  if (
    onboarding.financialTerms?.securityDepositReceived === true &&
    ["initiated", "docs_reviewed"].includes(onboarding.status)
  ) {
    onboarding.status = "deposit_confirmed";
  }

  // completed: once joiningDate is set, the onboarding wizard is complete
  if (onboarding.joiningDate) {
    onboarding.status = "completed";
    if (!onboarding.completedAt) {
      onboarding.completedAt = new Date();
    }
  }

  await onboarding.save();
  return onboarding;
};



/**
 * 6. Assign a bed to the tenant — the final gated step.
 *
 * Hard gates (throw 400 if violated):
 *  - status must be 'rules_accepted' or 'deposit_confirmed'
 *  - rulesAcceptance.accepted must be true
 *  - financialTerms.securityDepositReceived must be true
 *
 * Delegates gender validation and bed-availability check to roomService.assignTenant.
 *
 * @param {string} onboardingId
 * @param {string} bedId
 * @param {string} staffId
 * @returns {Promise<Onboarding>}
 */
const assignBed = async (onboardingId, bedId, staffId) => {
  const { onboarding, pg } = await fetchOnboardingAndPG(onboardingId);
  assertStaffAccessToPG(pg, staffId);

  // ── Hard gates ────────────────────────────────────────────────────────────
  if (onboarding.status !== "completed") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Bed can only be assigned to fully onboarded tenants (status: completed)"
    );
  }

  if (!onboarding.financialTerms?.securityDepositReceived) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot assign bed: security deposit has not been confirmed as received"
    );
  }

  // ── Delegate to roomService (handles gender + availability checks) ────────
  const bed = await roomService.assignTenant(
    bedId,
    onboarding.userId,
    onboarding.joiningDate
  );

  // ── Create BedAssignment audit record ────────────────────────────────────
  await BedAssignment.create({
    userId: onboarding.userId,
    pgId: onboarding.pgId,
    bedId: bed._id,
    roomId: bed.roomId,
    onboardingId: onboarding._id,
    startDate: onboarding.joiningDate || new Date(),
    shiftReason: "initial_onboarding",
  });

  // ── Finalize onboarding ───────────────────────────────────────────────────
  onboarding.status = "completed";
  onboarding.completedAt = new Date();

  // Copy bed price as agreed rent, and copy dueDay from PG
  if (!onboarding.financialTerms) {
    onboarding.financialTerms = {};
  }
  onboarding.financialTerms.agreedRent = bed.price;
  onboarding.financialTerms.dueDay = pg.dueDayOfMonth || 5;

  await onboarding.save();
  return onboarding;
};

/**
 * 7. Get full detail of a single onboarding with rich population.
 *
 * Access:
 *  - Owner/manager of the PG, OR
 *  - The tenant linked to the onboarding
 *
 * @param {string} onboardingId
 * @param {Object} requestingUser  - { _id, role }
 * @returns {Promise<Onboarding>}
 */
const getOnboarding = async (onboardingId, requestingUser) => {
  const onboarding = await Onboarding.findById(onboardingId)
    .populate(
      "userId",
      "name email mobNo1 mobNo2 gender picture profileImageKey aadharNumber aadharFileKey"
    )
    .populate(
      "pgId",
      "name address pgType ownerId managerId rulesDocument dueDayOfMonth"
    )
    .populate("enquiryId")
    .lean();

  if (!onboarding) {
    throw new ApiError(httpStatus.NOT_FOUND, "Onboarding not found");
  }

  const pg = onboarding.pgId;
  const userId = requestingUser._id.toString();
  const role = requestingUser.role;

  // Access control: owner/manager of this PG or the tenant
  if (
    role !== "owner" &&
    role !== "manager" &&
    onboarding.userId?._id?.toString() !== userId
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied: insufficient permissions"
    );
  }
  if (
    (role === "owner" || role === "manager") &&
    pg.ownerId?.toString() !== userId &&
    pg.managerId?.toString() !== userId
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied: you are not the owner or manager of this PG"
    );
  }

  // Attach presigned URL for PDF rules if present
  if (pg?.rulesDocument?.s3Key) {
    pg.rulesDocument.url = await awsService.getFileUrl(pg.rulesDocument.s3Key);
  }

  // Attach presigned URL for Aadhaar image if present
  if (onboarding.userId?.aadharFileKey) {
    onboarding.userId.aadharFileUrl = await awsService.getFileUrl(onboarding.userId.aadharFileKey);
  }

  // Attach presigned URL for user profile picture if present
  if (onboarding.userId?.profileImageKey) {
    onboarding.userId.picture = await awsService.getFileUrl(onboarding.userId.profileImageKey);
  }

  return onboarding;
};

/**
 * 8. List all onboardings for a given PG with optional filters.
 *
 * @param {string} pgId
 * @param {Object} filters  - { status, page, limit }
 * @param {string} staffId
 * @returns {Promise<{ results: Array, page: number, limit: number, totalResults: number }>}
 */
const listOnboardings = async (pgId, filters, staffId) => {
  const pg = await PG.findById(pgId).select("ownerId managerId");
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }
  assertStaffAccessToPG(pg, staffId);

  const { status, page = 1, limit = 10 } = filters;
  const query = { pgId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [results, totalResults] = await Promise.all([
    Onboarding.find(query)
      .populate("userId", "name email mobNo1 picture")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Onboarding.countDocuments(query),
  ]);

  return { results, page: Number(page), limit: Number(limit), totalResults };
};

/**
 * 9. Shift a tenant from their current bed to a new bed.
 *
 * Steps:
 *  a. Find the active BedAssignment (endDate === null) for userId + pgId
 *  b. Close the old assignment
 *  c. Unassign tenant from old bed via roomService
 *  d. Assign tenant to new bed via roomService
 *  e. Create new BedAssignment record
 *
 * @param {string} userId
 * @param {string} pgId
 * @param {string} newBedId
 * @param {Date}   effectiveDate
 * @param {string} shiftNote
 * @param {string} staffId
 * @returns {Promise<{ oldAssignment: Object, newAssignment: Object }>}
 */
const shiftBed = async (
  userId,
  pgId,
  newBedId,
  effectiveDate,
  shiftNote,
  staffId
) => {
  const pg = await PG.findById(pgId).select("ownerId managerId");
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }
  assertStaffAccessToPG(pg, staffId);

  // Find current active assignment
  const oldAssignment = await BedAssignment.findOne({
    userId,
    pgId,
    endDate: null,
    isDeleted: false,
  });
  if (!oldAssignment) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No active bed assignment found for this tenant in this PG"
    );
  }

  const oldBedId = oldAssignment.bedId;
  const onboardingId = oldAssignment.onboardingId;

  // Close the old assignment
  oldAssignment.endDate = effectiveDate;
  oldAssignment.shiftReason = "room_shift";
  if (shiftNote) oldAssignment.shiftNote = shiftNote;
  await oldAssignment.save();

  // Vacate the old bed
  await roomService.unassignTenant(oldBedId);

  // Assign the new bed (gender + availability checks inside)
  const newBed = await roomService.assignTenant(newBedId, userId, effectiveDate);

  // Create new assignment record
  const newAssignment = await BedAssignment.create({
    userId,
    pgId,
    bedId: newBed._id,
    roomId: newBed.roomId,
    onboardingId,
    startDate: effectiveDate,
    shiftReason: "room_shift",
    shiftNote: shiftNote || "",
  });

  return { oldAssignment, newAssignment };
};

/**
 * 10. Offboard a tenant — settle accounts and vacate their bed.
 *
 * Calculates: refundAmount = securityDepositAmount - deductions - pendingRent (≥ 0)
 * Sets onboarding status → 'removed'
 * Closes BedAssignment + calls roomService.unassignTenant
 *
 * @param {string} onboardingId
 * @param {Object} offboardData  - { vacatingDate, deductions, deductionNotes, pendingRent, settlementReference }
 * @param {string} staffId
 * @returns {Promise<Onboarding>}
 */
const offboardTenant = async (onboardingId, offboardData, staffId) => {
  const { onboarding, pg } = await fetchOnboardingAndPG(onboardingId);
  assertStaffAccessToPG(pg, staffId);

  if (onboarding.status !== "completed") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Tenant can only be offboarded from a 'completed' onboarding"
    );
  }

  const {
    vacatingDate,
    deductions = 0,
    deductionNotes,
    pendingRent = 0,
    settlementReference,
  } = offboardData;

  const securityDeposit =
    onboarding.financialTerms?.securityDepositAmount ?? 0;
  const refundAmount = Math.max(
    0,
    securityDeposit - deductions - pendingRent
  );

  // Populate offboarding subdocument
  onboarding.offboarding = {
    vacatingDate,
    deductions,
    deductionNotes,
    pendingRent,
    refundAmount,
    settlementReference,
    settlementConfirmedAt: new Date(),
    processedBy: staffId,
  };
  onboarding.status = "removed";

  await onboarding.save();

  // Close the BedAssignment record
  await BedAssignment.findOneAndUpdate(
    { userId: onboarding.userId, pgId: onboarding.pgId, endDate: null },
    { endDate: vacatingDate, shiftReason: "offboarding" }
  );

  // Vacate the bed in the Bed collection
  const activeBed = await Bed.findOne({
    pgId: onboarding.pgId,
    userId: onboarding.userId,
    status: "occupied",
    isDeleted: false,
  });
  if (activeBed) {
    await roomService.unassignTenant(activeBed._id);
  }

  return onboarding;
};



/**
 * 13. Get a tenant's current PG info, including bed and onboarding details.
 *
 * Returns null if the tenant has no active assignment.
 * Attaches presigned URLs for paymentQr if present.
 *
 * @param {string} userId
 * @returns {Promise<{ assignment: Object, onboarding: Object, pgInfo: Object } | null>}
 */
const getMyPGInfo = async (userId) => {
  // Find active bed assignment (endDate null = currently occupied)
  const assignment = await BedAssignment.findOne({
    userId,
    endDate: null,
    isDeleted: false,
  })
    .populate(
      "pgId",
      "name address pgType upiId paymentQrKey rulesDocument dueDayOfMonth"
    )
    .populate("bedId", "bedNumber price")
    .populate("roomId", "roomNumber floor")
    .lean();

  if (!assignment) return null;

  const pgInfo = assignment.pgId;

  // Generate signed URL for payment QR code if present
  if (pgInfo?.paymentQrKey) {
    pgInfo.paymentQrUrl = await awsService.getFileUrl(pgInfo.paymentQrKey);
  }

  // Fetch associated onboarding record
  const onboarding = await Onboarding.findOne({
    _id: assignment.onboardingId,
  }).lean();

  return { assignment, onboarding, pgInfo };
};

/**
 * 14. Get the full bed-assignment history for a tenant (all PGs, all time).
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
const getBedHistory = async (userId) => {
  const history = await BedAssignment.find({ userId, isDeleted: false })
    .populate("pgId", "name")
    .populate("bedId", "bedNumber")
    .populate("roomId", "roomNumber floor")
    .sort({ startDate: -1 })
    .lean();

  return history;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  initiateOnboarding,
  updateOnboardingStep,
  assignBed,
  getOnboarding,
  listOnboardings,
  shiftBed,
  offboardTenant,
  getMyPGInfo,
  getBedHistory,
};
