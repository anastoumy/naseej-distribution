import fs from "fs-extra";
import path from "path";
import { app } from "electron";
import sharp from "sharp";

const IMAGES_DIR = path.join(app.getPath("userData"), "product-images");

// Ensure images directory exists
export async function ensureImageDir(): Promise<void> {
  await fs.ensureDir(IMAGES_DIR);
}

/**
 * Save a product image file from a data URL
 * @param dataUrl - Base64 encoded image data URL
 * @param productId - Product ID for naming
 * @returns Relative path to the saved image (without /app-data/)
 */
export async function saveProductImage(
  dataUrl: string,
  productId: number
): Promise<string> {
  await ensureImageDir();

  try {
    // Extract base64 data from data URL
    const base64Data = dataUrl.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid data URL format");
    }

    // Generate filename
    const filename = `product-${productId}-${Date.now()}.webp`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Convert and optimize image using sharp
    const buffer = Buffer.from(base64Data, "base64");
    await sharp(buffer)
      .webp({ quality: 80 })
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .toFile(filepath);

    // Return relative path that can be passed back to renderer
    return filepath;
  } catch (error) {
    throw new Error(`Failed to save image: ${(error as Error).message}`);
  }
}

/**
 * Delete a product image
 */
export async function deleteProductImage(imagePath: string): Promise<void> {
  try {
    if (imagePath && fs.existsSync(imagePath)) {
      await fs.remove(imagePath);
    }
  } catch (error) {
    console.warn(`Failed to delete image: ${(error as Error).message}`);
  }
}

/**
 * Get image as data URL for preview
 */
export async function getImageDataUrl(imagePath: string): Promise<string> {
  try {
    if (!imagePath || !fs.existsSync(imagePath)) {
      return "";
    }
    const buffer = await fs.readFile(imagePath);
    return `data:image/webp;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(`Failed to read image: ${(error as Error).message}`);
    return "";
  }
}

/**
 * Check if image file exists
 */
export function imageExists(imagePath: string): boolean {
  return imagePath ? fs.existsSync(imagePath) : false;
}
