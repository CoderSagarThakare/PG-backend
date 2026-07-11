const httpStatus = require('http-status');
const { Room, Bed, PG, Enquiry, Post, User, Onboarding, BedAssignment } = require('../models');
const postService = require('./post.service');
const ApiError = require('../utils/ApiError');

/**
 * Update PG bed statistics
 * @param {string} pgId
 */
const updatePGBedStats = async (pgId) => {
  const [totalBeds, occupiedBeds, emptyBeds, totalRooms] = await Promise.all([
    Bed.countDocuments({ pgId, isDeleted: false }),
    Bed.countDocuments({ pgId, status: 'occupied', isDeleted: false }),
    Bed.countDocuments({ pgId, status: 'available', isDeleted: false }),
    Room.countDocuments({ pgId, isDeleted: false })
  ]);

  await PG.updateOne(
    { _id: pgId },
    { $set: { totalRooms, totalBeds, occupiedBeds, emptyBeds } }
  );

  // Automatically keep active vacancy post count in sync with emptyBeds
  await postService.syncPostVacancy(pgId);
};

/**
 * Create a room and its associated beds
 * @param {Object} roomBody
 * @returns {Promise<Room>}
 */
const createRoom = async (roomBody) => {
  const { pgId, roomNumber, floor, sharingType, roomType, beds } = roomBody;

  // Check if room number already exists for this PG
  const existingRoom = await Room.findOne({ pgId, roomNumber, isDeleted: false });
  if (existingRoom) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Room number already exists in this PG');
  }

  const room = await Room.create({ pgId, roomNumber, floor, sharingType, roomType });

  // Create beds
  const bedsToCreate = beds.map(bed => ({
    roomId: room._id,
    pgId,
    bedNumber: `${roomNumber}-${bed.bedNumber}`,
    price: bed.price,
    position: bed.position,
    status: 'available'
  }));

  await Bed.insertMany(bedsToCreate);
  await updatePGBedStats(pgId);

  return room;
};

/**
 * Get all rooms with their beds for a PG
 * @param {string} pgId
 * @returns {Promise<Array>}
 */
const getRoomsByPg = async (pgId) => {
  const rooms = await Room.find({ pgId, isDeleted: false }).lean();
  const roomIds = rooms.map(r => r._id);
  const beds = await Bed.find({ roomId: { $in: roomIds }, isDeleted: false }).populate('userId', 'name email mobNo1 vehicleType vehicleNumber');

  // Map beds to their rooms
  return rooms.map(room => ({
    ...room,
    beds: beds.filter(b => b.roomId.toString() === room._id.toString())
  }));
};

/**
 * Assign a tenant to a bed
 * @param {string} bedId
 * @param {string} userId
 * @param {Date|string} [joiningDate]
 * @returns {Promise<Bed>}
 */
const assignTenant = async (bedId, userId, joiningDate) => {
  const bed = await Bed.findById(bedId);
  if (!bed || bed.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }
  if (bed.status !== 'available') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bed is already occupied or under maintenance');
  }

  // Verify that there is an enquiry with 'dealDone' status for this user and PG
  const enquiry = await Enquiry.findOne({ 
    userId, 
    pgId: bed.pgId, 
    status: 'dealDone',
    isDeleted: false 
  });

  if (!enquiry) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign bed: Tenant must have an enquiry with "dealDone" status for this property.');
  }

  // Ensure user is not already assigned to another bed in this PG
  const existingAssignment = await Bed.findOne({ pgId: bed.pgId, userId, status: 'occupied', isDeleted: false });
  if (existingAssignment) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign bed: Tenant already has an active occupancy in this property.');
  }

  // ── Gender validation against PG type ──────────────────────────────────────
  const [pg, user] = await Promise.all([
    PG.findById(bed.pgId).select('pgType'),
    User.findById(userId).select('gender'),
  ]);

  if (!user || !user.gender) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Please set your gender in Profile before being assigned a bed.',
    );
  }

  if (pg.pgType === 'male' && user.gender !== 'male') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This is a Male PG. Only male tenants can be assigned here.',
    );
  }
  if (pg.pgType === 'female' && user.gender !== 'female') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This is a Female PG. Only female tenants can be assigned here.',
    );
  }
  if (pg.pgType === 'unisex' && !['male', 'female'].includes(user.gender)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Gender must be Male or Female for Unisex PG bed assignment.',
    );
  }
  // coLiving: any gender is fine as long as it is set (already checked above)

  bed.userId    = userId;
  bed.status    = 'occupied';
  bed.assignedAt = joiningDate ? new Date(joiningDate) : new Date();
  await bed.save();

  await updatePGBedStats(bed.pgId);

  // Sync vacancy post count (non-critical — errors are swallowed inside syncPostVacancy)
  await postService.syncPostVacancy(bed.pgId, { userGender: user.gender, delta: -1 });

  // ── Create BedAssignment audit record and finalize Onboarding ─────────────
  const onboarding = await Onboarding.findOne({
    userId,
    pgId: bed.pgId,
    status: { $nin: ['removed', 'cancelled'] },
    isDeleted: false
  });

  await BedAssignment.create({
    userId,
    pgId: bed.pgId,
    bedId: bed._id,
    roomId: bed.roomId,
    onboardingId: onboarding ? onboarding._id : null,
    startDate: joiningDate ? new Date(joiningDate) : new Date(),
    shiftReason: 'initial_onboarding',
  });

  if (onboarding && onboarding.status !== 'onboarding_completed') {
    onboarding.status = 'onboarding_completed';
    onboarding.completedAt = new Date();
    await onboarding.save();
  }

  return bed;
};

/**
 * Remove a tenant from a bed
 * @param {string} bedId
 * @returns {Promise<Bed>}
 */
const unassignTenant = async (bedId) => {
  const bed = await Bed.findById(bedId);
  if (!bed || bed.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }

  // Capture the previous occupant's gender BEFORE clearing the bed
  // so syncPostVacancy knows which counter to increment
  const prevUser = bed.userId
    ? await User.findById(bed.userId).select('gender')
    : null;

  // Close the BedAssignment record
  if (bed.userId) {
    await BedAssignment.findOneAndUpdate(
      { userId: bed.userId, pgId: bed.pgId, endDate: null },
      { endDate: new Date(), shiftReason: 'offboarding' }
    );
  }

  bed.userId    = null;
  bed.status    = 'available';
  bed.assignedAt = null;
  await bed.save();

  await updatePGBedStats(bed.pgId);

  // Sync vacancy post count back up
  await postService.syncPostVacancy(bed.pgId, {
    userGender: prevUser?.gender,
    delta: +1,
  });

  return bed;
};

/**
 * Update bed details (price, position, status)
 * @param {string} bedId
 * @param {Object} updateBody
 * @returns {Promise<Bed>}
 */
const updateBed = async (bedId, updateBody) => {
  const bed = await Bed.findById(bedId);
  if (!bed || bed.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }

  Object.assign(bed, updateBody);
  await bed.save();

  if (updateBody.status) {
    await updatePGBedStats(bed.pgId);
  }
  return bed;
};

/**
 * Update room details
 * @param {string} roomId
 * @param {Object} updateBody
 * @returns {Promise<Room>}
 */
const updateRoom = async (roomId, updateBody) => {
  const room = await Room.findById(roomId);
  if (!room || room.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const newSharingType = Number(updateBody.sharingType);
  const oldSharingType = room.sharingType;

  // 1. Sync Beds if sharingType changes
  if (updateBody.sharingType && newSharingType !== oldSharingType) {
    const currentBeds = await Bed.find({ roomId: room._id, isDeleted: false }).sort({ bedNumber: 1 });
    
    if (newSharingType < oldSharingType) {
      // Removing beds from the end
      const bedsToRemove = currentBeds.slice(newSharingType);
      if (bedsToRemove.some(b => b.status === 'occupied')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot reduce occupancy: some beds at the end are currently occupied.');
      }
      await Bed.updateMany({ _id: { $in: bedsToRemove.map(b => b._id) } }, { isDeleted: true });
    } else {
      // Adding beds
      const bedsToAdd = [];
      for (let i = oldSharingType; i < newSharingType; i++) {
        const char = String.fromCharCode(65 + i);
        const bedData = updateBody.beds?.[i] || {};
        bedsToAdd.push({
          roomId: room._id,
          pgId: room.pgId,
          bedNumber: `${updateBody.roomNumber || room.roomNumber}-${char}`,
          price: bedData.price || currentBeds[0]?.price || 0,
          position: bedData.position || '',
          status: 'available'
        });
      }
      await Bed.insertMany(bedsToAdd);
    }
  }

  // 2. Update existing beds details (price/position) if provided
  if (updateBody.beds) {
    for (const bedData of updateBody.beds) {
      if (bedData._id) {
        await Bed.updateOne(
          { _id: bedData._id },
          { $set: { price: bedData.price, position: bedData.position } }
        );
      }
    }
  }

  // 3. If room number changes, update all bed numbers prefix
  const finalRoomNumber = updateBody.roomNumber || room.roomNumber;
  if (updateBody.roomNumber && updateBody.roomNumber !== room.roomNumber) {
    const beds = await Bed.find({ roomId: room._id, isDeleted: false });
    for (const bed of beds) {
      const suffix = bed.bedNumber.split('-')[1];
      bed.bedNumber = `${finalRoomNumber}-${suffix}`;
      await bed.save();
    }
  }

  Object.assign(room, updateBody);
  await room.save();
  
  await updatePGBedStats(room.pgId);
  return room;
};

/**
 * Delete a room and its beds (soft delete)
 * @param {string} roomId
 * @returns {Promise<void>}
 */
const deleteRoom = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, 'Room not found');

  room.isDeleted = true;
  await room.save();

  await Bed.updateMany({ roomId: room._id }, { isDeleted: true });
  await updatePGBedStats(room.pgId);
};

/**
 * Get users eligible for bed assignment (those with dealDone status)
 * @param {string} pgId
 * @returns {Promise<Array>}
 */
const getEligibleTenants = async (pgId) => {
  const [onboardings, occupiedBeds, pg] = await Promise.all([
    Onboarding.find({ pgId, status: 'onboarding_completed', isDeleted: false })
      .populate('userId', 'name email mobNo1 gender vehicleType vehicleNumber')
      .lean(),
    Bed.find({ pgId, status: 'occupied', isDeleted: false }).select('userId').lean(),
    PG.findById(pgId).select('pgType'),
  ]);

  const occupiedUserIds = new Set(occupiedBeds.map(b => b.userId?.toString()).filter(Boolean));

  // Users with completed onboarding who don't yet have a bed in this PG
  const unassigned = onboardings
    .map(o => o.userId)
    .filter(user => user && !occupiedUserIds.has(user._id.toString()));

  // Separate gender-compatible and mismatched users
  const isGenderCompatible = (user) => {
    if (!user.gender) return false;
    if (pg.pgType === 'male')     return user.gender === 'male';
    if (pg.pgType === 'female')   return user.gender === 'female';
    if (pg.pgType === 'unisex')   return ['male', 'female'].includes(user.gender);
    return true; // coLiving or unknown: allow all
  };

  const eligible = unassigned.filter(isGenderCompatible);
  const genderMismatchCount = unassigned.filter(u => !isGenderCompatible(u)).length;

  return { users: eligible, genderMismatchCount };
};

module.exports = {
  createRoom,
  getRoomsByPg,
  assignTenant,
  unassignTenant,
  updateRoom,
  deleteRoom,
  updateBed,
  getEligibleTenants,
  updatePGBedStats
};
