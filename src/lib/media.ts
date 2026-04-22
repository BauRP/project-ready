// Media upload service using Firebase Cloud Storage
// All images are scrubbed of EXIF/GPS/metadata before upload (zero-knowledge privacy)
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseStorage } from "./firebase";
import { scrubFile } from "./media-scrub";

export interface MediaAttachment {
  id: string;
  type: "image" | "audio" | "file";
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadMedia(file: File): Promise<MediaAttachment> {
  // PRIVACY: Strip all EXIF/GPS/metadata from images before upload
  const scrubbedFile = await scrubFile(file);

  const ext = scrubbedFile.name.split(".").pop() || "bin";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `chat-media/${id}.${ext}`;

  const storageRef = ref(firebaseStorage, path);
  await uploadBytes(storageRef, scrubbedFile, { contentType: scrubbedFile.type });
  const url = await getDownloadURL(storageRef);

  const type = getMediaType(scrubbedFile.type);

  return {
    id,
    type,
    url,
    name: file.name, // Keep original name for display
    size: scrubbedFile.size,
    mimeType: scrubbedFile.type,
  };
}

function getMediaType(mime: string): "image" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
