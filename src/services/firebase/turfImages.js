import { Platform } from "react-native";

let nativeStorage = null;
let hasNativeStorage = false;

if (Platform.OS !== "web") {
  try {
    nativeStorage = require("@react-native-firebase/storage").default;
    hasNativeStorage = true;
  } catch (error) {
    // Fall back to web SDK when native storage is unavailable.
  }
}

const REMOTE_IMAGE_URI_REGEX = /^(https?:\/\/|gs:\/\/|data:image\/)/i;
const MAX_IMAGE_SIZE = 1024 * 1024 * 10; // 10MB hard limit

const getFileExtension = (uri) => {
  if (typeof uri !== "string") return "jpg";
  const cleanedUri = uri.split("?")[0].split("#")[0];
  const match = cleanedUri.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() || "jpg";
};

const uploadImageAtPath = async (storagePath, imageUri, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (hasNativeStorage) {
        const reference = nativeStorage().ref(storagePath);

        const task = reference.putFile(imageUri, {
          cacheControl: "max-age=31536000",
          contentType: "image/jpeg",
        });

        task.on("state_changed", (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          console.log(`[Upload] Progress: ${(progress * 100).toFixed(0)}%`);
        });

        await task;
        return reference.getDownloadURL();
      }

      // Web SDK with 60-second timeout
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("./config");

      const response = await fetch(imageUri);
      const blob = await response.blob();

      if (blob.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Max 10MB allowed.`);
      }

      const storageRef = ref(storage, storagePath);

      const uploadPromise = uploadBytes(storageRef, blob, {
        cacheControl: "max-age=31536000",
        contentType: blob.type || "image/jpeg",
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Upload timeout after 60 seconds")), 60000)
      );

      await Promise.race([uploadPromise, timeoutPromise]);
      return getDownloadURL(storageRef);
    } catch (error) {
      console.error(`[Upload] Attempt ${attempt}/${retries} failed:`, error.message);

      if (attempt === retries) {
        throw new Error(`Upload failed after ${retries} attempts: ${error.message}`);
      }

      // Exponential backoff before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};

export const isRemoteImageUri = (uri) =>
  typeof uri === "string" && REMOTE_IMAGE_URI_REGEX.test(uri);

export async function uploadTurfImage({ companyId, turfId, imageUri, folder = "gallery", index = 0 }) {
  if (!imageUri) return null;
  if (isRemoteImageUri(imageUri)) return imageUri;
  if (!companyId) throw new Error("Company ID is required for turf image upload.");
  if (!turfId) throw new Error("Turf ID is required for turf image upload.");

  const extension = getFileExtension(imageUri);
  const uniqueSuffix = `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${folder}_${uniqueSuffix}.${extension}`;
  const storagePath = `companies/${companyId}/turfs/${turfId}/${folder}/${fileName}`;

  return uploadImageAtPath(storagePath, imageUri);
}

export async function uploadTurfImages({ companyId, turfId, coverImage = null, images = [] }) {
  let uploadedCoverImage = null;

  if (coverImage) {
    uploadedCoverImage = await uploadTurfImage({
      companyId,
      turfId,
      imageUri: coverImage,
      folder: "cover",
      index: 0,
    });
  }

  const uploadedImages = [];
  for (let i = 0; i < images.length; i += 1) {
    const imageUri = images[i];
    if (!imageUri) continue;

    const uploadedImage = await uploadTurfImage({
      companyId,
      turfId,
      imageUri,
      folder: "gallery",
      index: i,
    });

    if (uploadedImage) {
      uploadedImages.push(uploadedImage);
    }
  }

  return {
    coverImage: uploadedCoverImage,
    images: uploadedImages,
  };
}
