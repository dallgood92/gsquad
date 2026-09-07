const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

function createStorage() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const configured = Boolean(bucket && region);
  const staticCredentials = process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      }
    : undefined;
  const client = configured ? new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: staticCredentials,
  }) : null;

  const assertConfigured = () => {
    if (!configured) {
      const error = new Error("Attachment storage is not configured yet");
      error.statusCode = 503;
      throw error;
    }
  };

  const validateFile = ({ mimeType, size }) => {
    const isImage = IMAGE_TYPES.has(mimeType);
    const isVideo = VIDEO_TYPES.has(mimeType);
    if (!isImage && !isVideo) throw Object.assign(new Error("Choose a JPEG, PNG, WebP, GIF, MP4, WebM, or QuickTime file"), { statusCode: 400 });
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (!Number.isInteger(size) || size <= 0 || size > maxSize) throw Object.assign(new Error(`${isImage ? "Images" : "Videos"} must be smaller than ${isImage ? "15 MB" : "250 MB"}`), { statusCode: 400 });
    return isImage ? "IMAGE" : "VIDEO";
  };

  return {
    configured,
    validateFile,
    createUpload: async ({ conversationId, userId, originalName, mimeType, size }) => {
      assertConfigured();
      const kind = validateFile({ mimeType, size });
      const extension = originalName.includes(".") ? originalName.split(".").pop().replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "bin";
      const storageKey = `conversations/${conversationId}/${userId}/${randomUUID()}.${extension || "bin"}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: mimeType, ContentLength: size });
      return { storageKey, kind, uploadUrl: await getSignedUrl(client, command, { expiresIn: 300 }) };
    },
    verifyUpload: async ({ storageKey, mimeType, size }) => {
      assertConfigured();
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
      if (Number(result.ContentLength) !== size || result.ContentType !== mimeType) throw Object.assign(new Error("Uploaded file did not match its attachment details"), { statusCode: 400 });
    },
    getDownloadUrl: async (storageKey) => {
      assertConfigured();
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: storageKey }), { expiresIn: 3600 });
    },
    deleteObject: async (storageKey) => {
      if (configured) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },
  };
}

module.exports = { createStorage };
