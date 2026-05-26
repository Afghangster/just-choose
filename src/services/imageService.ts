import * as ImagePicker from "expo-image-picker";

import { supabase } from "../lib/supabase";

export async function pickDecisionImage() {
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

export async function uploadDecisionImage(userId: string, localUri: string) {
  if (!supabase) {
    return localUri;
  }

  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("decision-images")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

  if (error) {
    throw error;
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from("decision-images")
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if (signedUrlError) {
    throw signedUrlError;
  }

  return data.signedUrl;
}
