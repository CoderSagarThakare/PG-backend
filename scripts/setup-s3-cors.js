/**
 * One-time script to configure CORS on the pg-stay-bucket.
 * Run with: node scripts/setup-s3-cors.js
 */
require("dotenv").config();
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

const corsConfig = {
  CORSRules: [
    {
      // Allow browser uploads (PUT) from localhost and any production domain
      AllowedOrigins: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "*",  // Remove this and add your production domain once deployed
      ],
      AllowedMethods: ["GET", "PUT", "HEAD", "DELETE"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag", "x-amz-checksum-crc32"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function applyCorsToBucket() {
  try {
    console.log(`\nApplying CORS policy to bucket: ${BUCKET}...\n`);

    const command = new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: corsConfig,
    });

    await s3Client.send(command);
    console.log("✅ CORS policy applied successfully!\n");

    // Verify the policy was saved
    const getCommand = new GetBucketCorsCommand({ Bucket: BUCKET });
    const result = await s3Client.send(getCommand);
    console.log("📋 Active CORS Rules:");
    console.log(JSON.stringify(result.CORSRules, null, 2));
  } catch (error) {
    console.error("❌ Failed to apply CORS policy:", error.message);
    process.exit(1);
  }
}

applyCorsToBucket();
