const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { RekognitionClient, DetectTextCommand } = require("@aws-sdk/client-rekognition");
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

const rekognitionClient = new RekognitionClient({
  region: config.aws.s3.region,
  credentials: {
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
  },
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
 * @param {Object} user
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const getAvatarUploadUrl = (fileName, fileType, user) => {
  const folder = user ? `private/${user.role}s/${user.role}-${user.id || user._id}/profile` : "avatars";
  return generateUploadPresignedUrl(fileName, fileType, folder);
};

/**
 * Get a presigned upload URL for a PG showcase image.
 * @param {string} fileName
 * @param {string} fileType
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const getPGShowcaseUploadUrl = (fileName, fileType) => {
  return generateUploadPresignedUrl(fileName, fileType, "public/pgs/showcase");
};

/**
 * Get a presigned upload URL for a vacancy post showcase image.
 * @param {string} fileName
 * @param {string} fileType
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const getPostShowcaseUploadUrl = (fileName, fileType) => {
  return generateUploadPresignedUrl(fileName, fileType, "public/posts/showcase");
};

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

// ── Aadhaar Card verification & OCR ──────────────────────────────────────────

// Verhoeff algorithm lookup tables
const verhoeffD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const verhoeffP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const validateVerhoeff = (array) => {
  let c = 0;
  const invertedArray = array.split("").map(Number).reverse();
  for (let i = 0; i < invertedArray.length; i++) {
    c = verhoeffD[c][verhoeffP[i % 8][invertedArray[i]]];
  }
  return c === 0;
};

/**
 * Get a presigned upload URL for an Aadhaar document.
 * @param {string} fileName
 * @param {string} fileType
 * @param {Object} user
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
const getAadharUploadUrl = (fileName, fileType, user) => {
  const folder = user ? `private/${user.role}s/${user.role}-${user.id || user._id}/kyc` : "aadhar";
  return generateUploadPresignedUrl(fileName, fileType, folder);
};

/**
 * Validates an uploaded S3 image using AWS Rekognition.
 * Checks for Aadhaar keywords and extracts/verifies the 12-digit number.
 * @param {string} key - S3 object key
 * @returns {Promise<string>} Verified Aadhaar Number
 */
const validateAadharImageOCR = async (key) => {
  try {
    const command = new DetectTextCommand({
      Image: {
        S3Object: {
          Bucket: BUCKET,
          Name: key,
        },
      },
    });

    const response = await rekognitionClient.send(command);
    const detections = response.TextDetections || [];
    const texts = detections.map((d) => d.DetectedText || "");

    const keywords = [
      "government of india",
      "bharat sarkar",
      "unique identification",
      "authority of india",
      "aadhaar",
      "aadhar",
      "enrollment",
      "male",
      "female",
      "dob:",
      "year of birth",
      "yob"
    ];

    const textCombined = texts.join(" ").toLowerCase();
    const hasKeywords = keywords.some((kw) => textCombined.includes(kw));

    if (!hasKeywords) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Aadhaar document. Please upload a clear photo of your Aadhaar card.");
    }

    // Try finding contiguous 12 digits first
    let foundAadhar = null;
    const contiguousRegex = /\b\d{12}\b/g;
    let contMatch;
    while ((contMatch = contiguousRegex.exec(textCombined)) !== null) {
      const candidate = contMatch[0];
      if (validateVerhoeff(candidate)) {
        foundAadhar = candidate;
        break;
      }
    }

    // Try finding sliding window blocks if not found
    if (!foundAadhar) {
      const blockRegex = /\b\d{4}\b/g;
      let match;
      const blocks = [];
      while ((match = blockRegex.exec(textCombined)) !== null) {
        blocks.push({
          value: match[0],
          index: match.index
        });
      }

      for (let i = 0; i <= blocks.length - 3; i++) {
        const b1 = blocks[i];
        const b2 = blocks[i+1];
        const b3 = blocks[i+2];

        const mid1 = textCombined.substring(b1.index + 4, b2.index);
        const mid2 = textCombined.substring(b2.index + 4, b3.index);

        const validSeparator = /^[-\s\.]+$/;
        if (validSeparator.test(mid1) && mid1.length <= 5 &&
            validSeparator.test(mid2) && mid2.length <= 5) {
          const candidate = b1.value + b2.value + b3.value;
          if (validateVerhoeff(candidate)) {
            foundAadhar = candidate;
            break;
          }
        }
      }
    }

    if (!foundAadhar) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Could not detect a valid 12-digit Aadhaar number. Please upload a clearer, well-lit image."
      );
    }

    return foundAadhar;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    console.error("Aadhaar Verification AWS Service Error:", error);

    if (error.name === 'AccessDeniedException') {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Aadhaar verification system configuration error (AccessDeniedException). Please ensure the AWS IAM user has 'rekognition:DetectText' permissions."
      );
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Aadhaar text detection failed: ${error.message || "Please ensure you upload a valid document image."}`
    );
  }
};

module.exports = {
  generateUploadPresignedUrl,
  getFileUrl,
  deleteFile,
  getAvatarUploadUrl,
  saveAvatarKey,
  deleteAvatar,
  getAadharUploadUrl,
  validateAadharImageOCR,
  getPGShowcaseUploadUrl,
  getPostShowcaseUploadUrl,
};

 
