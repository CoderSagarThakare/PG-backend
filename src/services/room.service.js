const httpStatus = require('http-status');
const { Room, Bed, PG, Enquiry, Post } = require('../models');

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
  const beds = await Bed.find({ roomId: { $in: roomIds }, isDeleted: false }).populate('userId', 'name email mobNo1');

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
 * @returns {Promise<Bed>}
 */
const assignTenant = async (bedId, userId) => {
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

  // Fetch the vacancy post to align bed rent price exactly with what was shown on the post!
  const post = await Post.findById(enquiry.postId);
  if (post && post.pricePerBed) {
    bed.price = post.pricePerBed;
  }

  bed.userId = userId;
  bed.status = 'occupied';
  await bed.save();

  await updatePGBedStats(bed.pgId);
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

  bed.userId = null;
  bed.status = 'available';
  await bed.save();

  await updatePGBedStats(bed.pgId);
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
  const enquiries = await Enquiry.find({ pgId, status: 'dealDone', isDeleted: false })
    .populate('userId', 'name email mobNo1')
    .lean();
  
  // Get all users who are already assigned to a bed in this PG
  const occupiedBeds = await Bed.find({ pgId, status: 'occupied', isDeleted: false });
  const occupiedUserIds = new Set(occupiedBeds.map(b => b.userId?.toString()));

  // Extract unique users who DON'T have a bed yet
  const users = enquiries
    .map(e => e.userId)
    .filter(user => user && !occupiedUserIds.has(user._id.toString()));
    
  return users;
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
