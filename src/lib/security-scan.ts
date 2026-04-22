// Simulated security scanning for media files
// Layer 1: EXIF/metadata stripping (pre-upload)
// Layer 2: Post-download threat simulation

export interface ScanResult {
  safe: boolean;
  threatType?: "virus" | "spyware" | "malware";
  fileName: string;
}

/**
 * Strip EXIF metadata from image files by re-encoding via canvas.
 * Returns a clean Blob.
 */
export async function stripExifMetadata(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
        } else {
          resolve(file);
        }
      }, file.type, 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Simulate a post-download security scan.
 * In production this would integrate with a real AV API.
 * Always returns safe=true for internal voice recordings.
 */
export function simulateSecurityScan(fileName: string, isInternalRecording: boolean = false): ScanResult {
  // Internal voice recordings bypass scanning
  if (isInternalRecording) {
    return { safe: true, fileName };
  }

  // Simulate: very low chance of "infected" for demo purposes
  // In production, replace with real scanning API
  const suspicious = fileName.toLowerCase().match(/\.(exe|bat|cmd|scr|pif|vbs|js|wsf|com)$/);
  if (suspicious) {
    return { safe: false, threatType: "malware", fileName };
  }

  return { safe: true, fileName };
}

/**
 * Get localized blocked file message
 */
export function getBlockedFileMessage(lang: string, type: "photo" | "file"): { title: string; footer: string } {
  if (lang === "ru" || lang === "kk") {
    const item = type === "photo" ? "фото" : "файл";
    return {
      title: `Это ${item} содержит вирус или шпион`,
      footer: "ОПАСНО: Файл заблокирован системой безопасности",
    };
  }
  const item = type === "photo" ? "photo" : "file";
  return {
    title: `This ${item} contains a virus or spyware`,
    footer: "DANGER: File blocked by security system",
  };
}
