import type { DecodedImage } from "../core/types.ts";

/**
 * Resizing modes for image processing
 */
export enum ResizeMode {
    /** Force exact dimensions by stretching/squashing */
    FORCE = "force",
    /** Pad with transparent background to reach target size */
    PAD = "pad",
    /** Pad with transparent background, center the image */
    PAD_CENTER = "pad-center",
}

/**
 * Resizing options
 */
export interface ResizeOptions {
    /** Target width (must be power of 2) */
    width: number;
    /** Target height (must be power of 2) */
    height: number;
    /** Resizing mode */
    mode?: ResizeMode;
    /** Whether to maintain aspect ratio (ignored for FORCE mode) */
    maintainAspectRatio?: boolean;
    /** Fill color for padding (RGBA values 0-255, default: transparent) */
    fillColor?: { r: number; g: number; b: number; a: number };
}

/**
 * Default resizing options
 */
const DEFAULT_RESIZE_OPTIONS: Required<Omit<ResizeOptions, "width" | "height">> = {
    mode: ResizeMode.PAD_CENTER,
    maintainAspectRatio: true,
    fillColor: { r: 0, g: 0, b: 0, a: 0 },
};

/**
 * Finds the nearest power of 2 that is greater than or equal to the given number
 */
export function nextPowerOf2(n: number): number {
    if (n <= 0) return 1;
    let power = 1;
    while (power < n) {
        power *= 2;
    }
    return power;
}

/**
 * Finds the nearest power of 2 that is less than or equal to the given number
 */
export function prevPowerOf2(n: number): number {
    if (n <= 0) return 1;
    let power = 1;
    while (power * 2 <= n) {
        power *= 2;
    }
    return power;
}

/**
 * Finds the closest power of 2 to the given number
 */
export function closestPowerOf2(n: number): number {
    if (n <= 0) return 1;
    const next = nextPowerOf2(n);
    const prev = prevPowerOf2(n);
    return (next - n) < (n - prev) ? next : prev;
}

/**
 * Calculates optimal power-of-2 dimensions for an image
 */
export function calculateOptimalDimensions(
    width: number,
    height: number,
    preferLarger: boolean = false,
): { width: number; height: number } {
    if (preferLarger) {
        return {
            width: nextPowerOf2(width),
            height: nextPowerOf2(height),
        };
    } else {
        return {
            width: closestPowerOf2(width),
            height: closestPowerOf2(height),
        };
    }
}

/**
 * Resizes an image to the specified dimensions
 */
export function resizeImage(image: DecodedImage, options: ResizeOptions): DecodedImage {
    const opts = { ...DEFAULT_RESIZE_OPTIONS, ...options };
    const { width: targetWidth, height: targetHeight, mode } = opts;

    if ((targetWidth & (targetWidth - 1)) !== 0 || (targetHeight & (targetHeight - 1)) !== 0) {
        throw new Error("Target dimensions must be powers of 2");
    }

    if (mode === ResizeMode.FORCE) {
        return stretchImage(image, targetWidth, targetHeight);
    }

    if (mode === ResizeMode.PAD || mode === ResizeMode.PAD_CENTER) {
        if (opts.maintainAspectRatio) {
            const aspectRatio = image.width / image.height;
            const targetAspectRatio = targetWidth / targetHeight;

            let finalWidth = targetWidth;
            let finalHeight = targetHeight;

            if (aspectRatio > targetAspectRatio) {
                finalHeight = Math.round(targetWidth / aspectRatio);
            } else {
                finalWidth = Math.round(targetHeight * aspectRatio);
            }

            finalWidth = closestPowerOf2(finalWidth);
            finalHeight = closestPowerOf2(finalHeight);

            return padImage(image, finalWidth, finalHeight, mode === ResizeMode.PAD_CENTER, opts.fillColor);
        }

        return padImage(image, targetWidth, targetHeight, mode === ResizeMode.PAD_CENTER, opts.fillColor);
    }

    throw new Error(`Unsupported resize mode: ${mode}`);
}

/**
 * Simple nearest-neighbor stretch (for FORCE mode)
 */
function stretchImage(image: DecodedImage, targetWidth: number, targetHeight: number): DecodedImage {
    const { width: srcWidth, height: srcHeight, pixels } = image;
    const stretchedPixels = new Uint8Array(targetWidth * targetHeight * 4);

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor((x * srcWidth) / targetWidth);
            const srcY = Math.floor((y * srcHeight) / targetHeight);

            const srcIdx = (srcY * srcWidth + srcX) * 4;
            const dstIdx = (y * targetWidth + x) * 4;

            stretchedPixels[dstIdx] = pixels[srcIdx];
            stretchedPixels[dstIdx + 1] = pixels[srcIdx + 1];
            stretchedPixels[dstIdx + 2] = pixels[srcIdx + 2];
            stretchedPixels[dstIdx + 3] = pixels[srcIdx + 3];
        }
    }

    return {
        width: targetWidth,
        height: targetHeight,
        pixels: stretchedPixels,
    };
}

/**
 * Pads an image with specified background color to reach target dimensions
 */
function padImage(
    image: DecodedImage,
    targetWidth: number,
    targetHeight: number,
    center: boolean = false,
    fillColor: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 0 },
): DecodedImage {
    const { width: srcWidth, height: srcHeight, pixels } = image;
    const paddedPixels = new Uint8Array(targetWidth * targetHeight * 4);

    let offsetX = 0;
    let offsetY = 0;

    if (center) {
        offsetX = Math.floor((targetWidth - srcWidth) / 2);
        offsetY = Math.floor((targetHeight - srcHeight) / 2);
    }

    for (let i = 0; i < paddedPixels.length; i += 4) {
        paddedPixels[i] = fillColor.r;
        paddedPixels[i + 1] = fillColor.g;
        paddedPixels[i + 2] = fillColor.b;
        paddedPixels[i + 3] = fillColor.a;
    }

    for (let y = 0; y < srcHeight; y++) {
        for (let x = 0; x < srcWidth; x++) {
            const srcIdx = (y * srcWidth + x) * 4;
            const dstIdx = ((y + offsetY) * targetWidth + (x + offsetX)) * 4;

            paddedPixels[dstIdx] = pixels[srcIdx];
            paddedPixels[dstIdx + 1] = pixels[srcIdx + 1];
            paddedPixels[dstIdx + 2] = pixels[srcIdx + 2];
            paddedPixels[dstIdx + 3] = pixels[srcIdx + 3];
        }
    }

    return {
        width: targetWidth,
        height: targetHeight,
        pixels: paddedPixels,
    };
}

/**
 * Auto-resizes an image to the nearest power-of-2 dimensions
 */
export function autoResizeToPowerOf2(
    image: DecodedImage,
    mode: ResizeMode = ResizeMode.PAD_CENTER,
    preferLarger: boolean = false,
    fillColor?: { r: number; g: number; b: number; a: number },
): DecodedImage {
    const optimalDims = calculateOptimalDimensions(image.width, image.height, preferLarger);

    if ((image.width & (image.width - 1)) === 0 && (image.height & (image.height - 1)) === 0) {
        return image;
    }

    return resizeImage(image, {
        width: optimalDims.width,
        height: optimalDims.height,
        mode,
        fillColor,
    });
}

/**
 * Convenience function for padding to power of 2
 */
export function padToPowerOf2(
    image: DecodedImage,
    preferLarger: boolean = false,
    fillColor?: { r: number; g: number; b: number; a: number },
): DecodedImage {
    return autoResizeToPowerOf2(image, ResizeMode.PAD, preferLarger, fillColor);
}

/**
 * Convenience function for center padding to power of 2
 */
export function centerPadToPowerOf2(
    image: DecodedImage,
    preferLarger: boolean = false,
    fillColor?: { r: number; g: number; b: number; a: number },
): DecodedImage {
    return autoResizeToPowerOf2(image, ResizeMode.PAD_CENTER, preferLarger, fillColor);
}
