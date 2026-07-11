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
 *  10. offboardTenant       — owner initiates: sets settlement_pending, vacates bed, captures breakdown
 *  11. confirmSettlement    — tenant confirms receipt; status → removed
 *  12. queryTenants         — central tenant directory listing for owners
 *  13. getPGRulesUploadUrl  — presigned S3 PUT URL for rules PDF
 *  14. updatePGRules        — save rules metadata on the PG document
 *  15. getMyPGInfo          — tenant reads their own PG/bed/onboarding info
 *  16. getBedHistory        — full bed history for a tenant
 */

const httpStatus = require("http-status");
const {
  Onboarding,
  BedAssignment,
  Bed,
  PG,
  Enquiry,
  User,
  RentPayment,
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
  const enquiry = await Enquiry.findById(enquiryId).populate("userId");
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }
  if (enquiry.status !== "dealDone") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Onboarding can only be initiated for enquiries with status 'dealDone'"
    );
  }

  // Validate tenant profile is complete (Option A)
  const user = enquiry.userId;
  if (user) {
    const missing = [];
    if (!user.mobNo1) missing.push("mobile number");
    if (!user.gender) missing.push("gender");
    if (!user.aadharNumber) missing.push("Aadhaar number");
    if (!user.aadharFileKey) missing.push("Aadhaar document copy");
    if (!user.address?.pincode || !user.address?.city || !user.address?.state) {
      missing.push("permanent address");
    }

    if (missing.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot initiate onboarding: Tenant's profile is incomplete. Missing: ${missing.join(", ")}.`
      );
    }
  }

  // Guard against duplicate active onboarding for the same enquiry or user/PG — return existing to allow resuming
  const existing = await Onboarding.findOne({
    $or: [
      { enquiryId },
      { userId: enquiry.userId, pgId: enquiry.pgId }
    ],
    status: { $nin: ["removed", "cancelled"] },
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

  // onboarding_completed: once joiningDate is set, the onboarding wizard is complete
  if (onboarding.joiningDate) {
    onboarding.status = "onboarding_completed";
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

  // ── Hard gates ───────────────────────────────────────────────────────────────
  if (onboarding.status !== "onboarding_completed") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Bed can only be assigned to fully onboarded tenants (status: onboarding_completed)"
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

  // ── Finalize onboarding ───────────────────────────────────────────────────────────
  onboarding.status = "onboarding_completed";
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
      "name address pgType ownerId managerId dueDayOfMonth"
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


  // Attach active bed if stay is completed/active
  const activeBed = await Bed.findOne({
    pgId: onboarding.pgId?._id || onboarding.pgId,
    userId: onboarding.userId?._id || onboarding.userId,
    status: "occupied",
    isDeleted: false,
  }).populate("roomId").lean();

  if (activeBed) {
    onboarding.currentBedId = activeBed;
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
  if (status && status !== "all") query.status = status;

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

  const userIds = results.map(o => o.userId?._id || o.userId).filter(Boolean);
  const activeBeds = await Bed.find({
    pgId,
    userId: { $in: userIds },
    status: "occupied",
    isDeleted: false,
  }).populate("roomId").lean();

  const bedMap = new Map();
  for (const bed of activeBeds) {
    if (bed.userId) {
      bedMap.set(bed.userId.toString(), bed);
    }
  }

  for (const o of results) {
    const uId = o.userId?._id || o.userId;
    if (uId && bedMap.has(uId.toString())) {
      o.currentBedId = bedMap.get(uId.toString());
    }
  }

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
 * 10. Offboard a tenant — owner-initiated step.
 *
 * Sets status to 'settlement_pending' and immediately:
 *  - closes the BedAssignment (endDate = exitDate)
 *  - vacates the bed via roomService.unassignTenant
 * Does NOT yet set settlementConfirmedAt (that happens in confirmSettlement).
 *
 * @param {string} onboardingId
 * @param {Object} offboardData  - { exitDate, reason, deductions, deductionNotes, pendingRent, settlementReference }
 * @param {string} staffId
 * @returns {Promise<Onboarding>}
 */
const offboardTenant = async (onboardingId, offboardData, staffId) => {
  const { onboarding, pg } = await fetchOnboardingAndPG(onboardingId);
  assertStaffAccessToPG(pg, staffId);

  if (onboarding.status !== "onboarding_completed") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Tenant can only be offboarded from an 'onboarding_completed' stay"
    );
  }

  // Verify that the tenant has paid all months of rent (no unpaid records)
  const unpaidRent = await RentPayment.findOne({
    userId: onboarding.userId,
    status: { $in: ["pending", "under_review", "partial", "overdue"] },
    isDeleted: false,
  });

  if (unpaidRent) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot offboard tenant: There are unpaid or pending rent records for this tenant (Month: ${unpaidRent.rentMonth}, Status: ${unpaidRent.status}). Please clear all outstanding rent first.`
    );
  }

  const {
    exitDate,
    reason,
    deductions = 0,
    deductionNotes,
    pendingRent = 0,
    settlementReference,
  } = offboardData;

  const securityDeposit =
    onboarding.financialTerms?.securityDepositAmount ?? 0;
  const refundAmount = Math.max(
    0,
    securityDeposit - Number(deductions) - Number(pendingRent)
  );

  // Populate offboarding subdocument (settlement not yet confirmed)
  onboarding.offboarding = {
    exitDate,
    reason,
    deductions: Number(deductions),
    deductionNotes,
    pendingRent: Number(pendingRent),
    refundAmount,
    settlementReference,
    settlementConfirmedAt: null,
    processedBy: staffId,
  };
  onboarding.status = "settlement_pending";

  await onboarding.save();

  // Close the BedAssignment record immediately
  await BedAssignment.findOneAndUpdate(
    { userId: onboarding.userId, pgId: onboarding.pgId, endDate: null },
    { endDate: exitDate || new Date(), shiftReason: "offboarding" }
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
 * 11. Confirm settlement — tenant-initiated final step.
 *
 * The tenant confirms they received the refund from the owner.
 * Sets settlementConfirmedAt and moves status to 'removed'.
 *
 * @param {string} onboardingId
 * @param {string} userId  - must match onboarding.userId
 * @returns {Promise<Onboarding>}
 */
const confirmSettlement = async (onboardingId, userId) => {
  const onboarding = await Onboarding.findById(onboardingId);
  if (!onboarding) {
    throw new ApiError(httpStatus.NOT_FOUND, "Onboarding record not found");
  }

  // Ensure only the correct tenant can confirm
  if (onboarding.userId.toString() !== userId.toString()) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access denied: you are not the tenant for this onboarding"
    );
  }

  if (onboarding.status !== "settlement_pending") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Settlement can only be confirmed when status is 'settlement_pending'"
    );
  }

  onboarding.offboarding.settlementConfirmedAt = new Date();
  onboarding.status = "removed";

  await onboarding.save();
  return onboarding;
};

/**
 * 12. Query Tenants — central tenant directory for owners/managers.
 *
 * Returns paginated list of onboardings across all PGs managed by staffId,
 * with optional search and status filters.
 *
 * @param {Object} filters  - { search, pgId, status, page, limit }
 * @param {string} staffId
 * @returns {Promise<{ results: Array, page: number, limit: number, totalResults: number }>}
 */
const queryTenants = async (filters, staffId) => {
  // Find all PGs this staff member manages
  const managedPGs = await PG.find({
    $or: [{ ownerId: staffId }, { managerId: staffId }],
    isDeleted: false,
  }).select("_id name");

  if (!managedPGs.length) {
    return { results: [], page: 1, limit: 10, totalResults: 0 };
  }

  const managedPGIds = managedPGs.map((p) => p._id);

  const { search, pgId, status, page = 1, limit = 20 } = filters;

  // Build query
  const query = { pgId: { $in: managedPGIds } };

  // Filter by specific PG if provided (must be in managed list)
  if (pgId) {
    if (!managedPGIds.some((id) => id.toString() === pgId)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied to this PG");
    }
    query.pgId = pgId;
  }

  // Status filter — default to active tenants only
  if (status && status !== "all") {
    query.status = status;
  } else if (!status) {
    query.status = "onboarding_completed";
  }

  const skip = (Number(page) - 1) * Number(limit);

  let queryBuilder = Onboarding.find(query)
    .populate("userId", "name email mobNo1 mobNo2 gender picture profileImageKey")
    .populate("pgId", "name address")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  let [results, totalResults] = await Promise.all([
    queryBuilder.lean(),
    Onboarding.countDocuments(query),
  ]);

  const userIds = results.map(o => o.userId?._id || o.userId).filter(Boolean);
  const activeBeds = await Bed.find({
    pgId: { $in: managedPGIds },
    userId: { $in: userIds },
    status: "occupied",
    isDeleted: false,
  }).populate("roomId").lean();

  const bedMap = new Map();
  for (const bed of activeBeds) {
    if (bed.userId && bed.pgId) {
      bedMap.set(`${bed.userId.toString()}_${bed.pgId.toString()}`, bed);
    }
  }

  for (const o of results) {
    const uId = o.userId?._id || o.userId;
    const pId = o.pgId?._id || o.pgId;
    if (uId && pId) {
      const key = `${uId.toString()}_${pId.toString()}`;
      if (bedMap.has(key)) {
        o.currentBedId = bedMap.get(key);
      }
    }
  }

  // Apply in-memory search on name / phone if provided
  if (search) {
    const term = search.toLowerCase();
    results = results.filter(
      (o) =>
        o.userId?.name?.toLowerCase().includes(term) ||
        o.userId?.mobNo1?.includes(term) ||
        o.userId?.email?.toLowerCase().includes(term)
    );
  }

  return { results, page: Number(page), limit: Number(limit), totalResults };
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
  // 1. Find active bed assignment (endDate null = currently occupied)
  const assignment = await BedAssignment.findOne({
    userId,
    endDate: null,
    isDeleted: false,
  })
    .populate(
      "pgId",
      "name address pgType upiId paymentQrKey dueDayOfMonth"
    )
    .populate("bedId", "bedNumber price")
    .populate("roomId", "roomNumber floor")
    .lean();

  if (assignment) {
    const pgInfo = assignment.pgId;
    if (pgInfo?.paymentQrKey) {
      pgInfo.paymentQrUrl = await awsService.getFileUrl(pgInfo.paymentQrKey);
    }
    const onboarding = await Onboarding.findOne({
      userId,
      pgId: pgInfo._id,
      status: { $nin: ["removed", "cancelled"] },
      isDeleted: false,
    }).lean();
    return { assignment, onboarding, pgInfo };
  }

  // 2. Fall back to completed onboarding if no active bed assignment exists
  const onboarding = await Onboarding.findOne({
    userId,
    status: { $nin: ["removed", "cancelled"] },
    isDeleted: false,
  })
    .populate(
      "pgId",
      "name address pgType upiId paymentQrKey dueDayOfMonth"
    )
    .lean();

  if (!onboarding) return null;

  const pgInfo = onboarding.pgId;
  if (pgInfo?.paymentQrKey) {
    pgInfo.paymentQrUrl = await awsService.getFileUrl(pgInfo.paymentQrKey);
  }

  return { assignment: null, onboarding, pgInfo };
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
  confirmSettlement,
  queryTenants,
  getMyPGInfo,
  getBedHistory,
};
