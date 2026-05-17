const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config/config");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const s3Client = new S3Client({
  region: config.aws.s3.region,
  credentials: {
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
  },
  // AWS SDK v3 (recent) adds CRC32 checksums by default to presigned URLs.
  // This breaks browser PUT uploads because the browser can't compute/send
  // the checksum header. Setting WHEN_REQUIRED disables this default behaviour.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET = config.aws.s3.bucketName;

/**
 * Generate a presigned URL for uploading a file directly to S3.
 * The file upload happens client-side — the file never touches the backend.
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type (e.g. image/jpeg)
 * @param {string} folder   - Logical folder in S3 (e.g. "avatars", "pgs")
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const generateUploadPresignedUrl = async (fileName, fileType, folder = "others") => {
  const key = `${folder}/${Date.now()}-${fileName.replace(/\s+/g, "_")}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: fileType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  return { uploadUrl, key };
};

/**
 * Generate a presigned GET URL for reading a private S3 object.
 * @param {string} key - S3 object key
 * @returns {Promise<string|null>}
 */
const getFileUrl = async (key) => {
  if (!key) return null;
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 604800 }); // 7 days
};

/**
 * Delete an object from S3.
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
const deleteFile = async (key) => {
  if (!key) return;
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3Client.send(command);
};

// ── Profile-image specific helpers ──────────────────────────────────────────

/**
 * Get a presigned upload URL for a profile avatar.
 * @param {string} fileName
 * @param {string} fileType
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const getAvatarUploadUrl = (fileName, fileType) =>
  generateUploadPresignedUrl(fileName, fileType, "avatars");

/**
 * After the client uploads the file to S3, save the key in the DB
 * and return a fresh presigned view URL.
 * @param {import("mongoose").Document} userDoc  - Mongoose user/staff document
 * @param {string} newKey                        - S3 key returned from generateUploadPresignedUrl
 * @param {string|null} oldKey                   - Previous S3 key to delete (or null)
 * @returns {Promise<string>} Fresh presigned view URL
 */
const saveAvatarKey = async (userDoc, newKey, oldKey) => {
  // Delete old avatar from S3 if it exists (avoid orphaned objects)
  if (oldKey && oldKey !== newKey) {
    await deleteFile(oldKey).catch(() => {}); // Non-blocking – don't fail on cleanup error
  }

  userDoc.profileImageKey = newKey;
  await userDoc.save();

  return getFileUrl(newKey);
};

/**
 * Remove the user's custom avatar from S3 and revert DB to default picture.
 * @param {import("mongoose").Document} userDoc
 * @param {string} defaultPicture - Default fallback URL
 * @returns {Promise<void>}
 */
const deleteAvatar = async (userDoc, defaultPicture = "https://i.imgur.com/CR1iy7U.png") => {
  const key = userDoc.profileImageKey;
  if (!key) throw new ApiError(httpStatus.BAD_REQUEST, "No custom avatar to delete");

  await deleteFile(key);
  userDoc.profileImageKey = null;
  userDoc.picture = defaultPicture;
  await userDoc.save();
};

module.exports = {
  generateUploadPresignedUrl,
  getFileUrl,
  deleteFile,
  getAvatarUploadUrl,
  saveAvatarKey,
  deleteAvatar,
};

 
