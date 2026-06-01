import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { supabase } from "../lib/supabase";

export const DECISION_IMAGE_BUCKET = "decision-images";

export type UploadedStorageImage = {
  imageUrl: string | null;
  imagePath: string | null;
};

export type ImageSource = "camera" | "library";

export async function pickDecisionImage(source: ImageSource = "library") {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.86,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    return result.assets[0].uri;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.86,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
}

export async function chooseDecisionImage() {
  return new Promise<string | null>((resolve) => {
    Alert.alert("Add photo", "Take a new photo or choose one from your library.", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      { text: "Take photo", onPress: () => pickDecisionImage("camera").then(resolve) },
      { text: "Choose photo", onPress: () => pickDecisionImage("library").then(resolve) },
    ]);
  });
}

export async function uploadDecisionImage(userId: string, localUri: string) {
  if (!supabase) {
    return { imageUrl: localUri, imagePath: null };
  }

  const path = `${userId}/${Date.now()}.jpg`;

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("No active session to upload image.");
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${DECISION_IMAGE_BUCKET}/${path}`;

  const uploadResult = await FileSystem.uploadAsync(url, localUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
  });

  if (uploadResult.status !== 200) {
    throw new Error("Failed to upload image.");
  }

  return {
    imageUrl: await createDecisionImageSignedUrl(path),
    imagePath: path,
  };
}

export async function uploadAvatarImage(userId: string, localUri: string) {
  if (!supabase) {
    return { imageUrl: localUri, imagePath: null };
  }

  const path = `${userId}/avatars/${Date.now()}.jpg`;

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("No active session to upload image.");
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${DECISION_IMAGE_BUCKET}/${path}`;

  const uploadResult = await FileSystem.uploadAsync(url, localUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
  });

  if (uploadResult.status !== 200) {
    throw new Error("Failed to upload image.");
  }

  return {
    imageUrl: await createDecisionImageSignedUrl(path),
    imagePath: path,
  };
}

export async function createDecisionImageSignedUrl(path: string, expiresInSeconds = 60 * 60) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(DECISION_IMAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export function extractDecisionImagePath(value?: string | null) {
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    return null;
  }

  const markers = [
    `/storage/v1/object/sign/${DECISION_IMAGE_BUCKET}/`,
    `/storage/v1/object/public/${DECISION_IMAGE_BUCKET}/`,
    `/storage/v1/object/authenticated/${DECISION_IMAGE_BUCKET}/`,
  ];

  for (const marker of markers) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }
    const encodedPath = value.slice(markerIndex + marker.length).split("?")[0];
    try {
      return decodeURIComponent(encodedPath);
    } catch {
      return encodedPath;
    }
  }

  return null;
}
