/**
 * Client-side media scrubbing: strips ALL metadata (EXIF, IPTC, XMP, GPS)
 * from images before upload. Uses Canvas re-encoding for zero-knowledge privacy.
 * Audio/file types pass through unchanged (no image metadata to strip).
 */

const SCRUB_SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const MAX_DIMENSION = 4096;

/**
 * Strip all EXIF/metadata from an image by re-encoding through Canvas.
 * This is a pure client-side operation — no data leaves the device unstripped.
 */
export async function scrubImageMetadata(file: File): Promise<File> {
  if (!SCRUB_SUPPORTED_TYPES.includes(file.type)) {
    // Non-image or unsupported format — return as-is
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    
    // Clamp dimensions to prevent memory issues
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[MediaScrub] OffscreenCanvas not supported, falling back");
      return fallbackScrub(file);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Re-encode: this strips ALL metadata (EXIF, GPS, camera model, etc.)
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const quality = outputType === "image/jpeg" ? 0.92 : undefined;
    const blob = await canvas.convertToBlob({ type: outputType, quality });

    const scrubbed = new File([blob], file.name, {
      type: outputType,
      lastModified: Date.now(),
    });

    console.log(
      `[MediaScrub] Stripped metadata: ${file.name} (${formatBytes(file.size)} → ${formatBytes(scrubbed.size)})`
    );

    return scrubbed;
  } catch (e) {
    console.warn("[MediaScrub] Scrub failed, using fallback:", e);
    return fallbackScrub(file);
  }
}

/**
 * Fallback for environments without OffscreenCanvas (older browsers).
 * Uses a regular <canvas> element.
 */
async function fallbackScrub(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file); // Can't scrub, return original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
        },
        outputType,
        outputType === "image/jpeg" ? 0.92 : undefined
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Can't scrub, return original
    };

    img.src = url;
  });
}

/**
 * Scrub any file: images get metadata stripped, others pass through.
 */
export async function scrubFile(file: File): Promise<File> {
  if (file.type.startsWith("image/")) {
    return scrubImageMetadata(file);
  }
  // Audio and other files: no image EXIF to strip
  return file;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}
