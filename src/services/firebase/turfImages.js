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

const getFileExtension = (uri) => {
  if (typeof uri !== "string") return "jpg";

  const cleanedUri = uri.split("?")[0].split("#")[0];
  const match = cleanedUri.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() || "jpg";
};

const uploadImageAtPath = async (storagePath, imageUri) => {
  if (hasNativeStorage) {
    const reference = nativeStorage().ref(storagePath);
    await reference.putFile(imageUri);
    return reference.getDownloadURL();
  }

  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const { storage } = await import("./config");

  const response = await fetch(imageUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
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
