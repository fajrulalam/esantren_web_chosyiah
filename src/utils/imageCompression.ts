// Browser-only helpers that shrink a phone photo to a JPEG under a byte cap
// before it is uploaded, so report photos stay cheap to store and quick to load.

const MAX_DIMENSION = 1280;
const INITIAL_JPEG_QUALITY = 0.75;

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    throw new Error("Foto tidak dapat dibaca. Pilih foto berformat JPG atau PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak mendukung kompresi foto.");
  // JPEG has no transparency; paint white so transparent PNGs don't turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengompres foto."))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Re-encodes the photo as JPEG (which also applies EXIF rotation and drops
 * location metadata), then lowers quality and finally dimensions until it
 * fits under `maxBytes`.
 */
export async function compressImageToLimit(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Berkas harus berupa foto.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  let canvas = drawToCanvas(image.source, image.width * scale, image.height * scale);
  if ("close" in image.source && typeof image.source.close === "function") image.source.close();

  let quality = INITIAL_JPEG_QUALITY;
  let blob = await canvasToJpeg(canvas, quality);
  while (blob.size > maxBytes && quality > 0.35) {
    quality -= 0.15;
    blob = await canvasToJpeg(canvas, quality);
  }
  while (blob.size > maxBytes && Math.max(canvas.width, canvas.height) > 480) {
    canvas = drawToCanvas(canvas, canvas.width * 0.75, canvas.height * 0.75);
    blob = await canvasToJpeg(canvas, 0.6);
  }
  if (blob.size > maxBytes) {
    const limitMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    throw new Error(`Foto masih lebih dari ${limitMb} MB setelah dikompresi. Pilih foto lain.`);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
