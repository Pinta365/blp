import type { DecodedImage } from "../core/types.ts";

/**
 * Decompresses a palettized (RAW1) BLP image to RGBA pixel data.
 * @param data - The palettized image data.
 * @param width - The width of the image in pixels.
 * @param height - The height of the image in pixels.
 * @param palette - The color palette (RGBA, 256 * 4 bytes).
 * @param alphaSize - The alpha channel bit depth (0, 1, 4, or 8).
 * @returns A DecodedImage object containing width, height, and RGBA pixel data.
 */
export function decompressRAW1(data: Uint8Array, width: number, height: number, palette: Uint8Array, alphaSize: number): DecodedImage {
    const numPixels = width * height;
    const out = new Uint8Array(numPixels * 4);
    const indices = data.subarray(0, numPixels);
    let alphaData: Uint8Array | null = null;
    if (alphaSize === 8) {
        alphaData = data.subarray(numPixels, numPixels * 2);
    } else if (alphaSize === 4) {
        alphaData = data.subarray(numPixels, numPixels + Math.ceil(numPixels / 2));
    } else if (alphaSize === 1) {
        alphaData = data.subarray(numPixels, numPixels + Math.ceil(numPixels / 8));
    }
    for (let i = 0; i < numPixels; i++) {
        const palIdx = indices[i] * 4;
        out[i * 4 + 0] = palette[palIdx + 2]; // R
        out[i * 4 + 1] = palette[palIdx + 1]; // G
        out[i * 4 + 2] = palette[palIdx + 0]; // B
        if (alphaSize === 8 && alphaData) {
            out[i * 4 + 3] = alphaData[i];
        } else if (alphaSize === 4 && alphaData) {
            const byte = alphaData[Math.floor(i / 2)];
            const nibble = (i % 2 === 0) ? (byte & 0x0F) : (byte >> 4);
            out[i * 4 + 3] = nibble * 17;
        } else if (alphaSize === 1 && alphaData) {
            const byte = alphaData[Math.floor(i / 8)];
            const bit = i % 8;
            out[i * 4 + 3] = (byte & (1 << bit)) ? 255 : 0;
        } else {
            out[i * 4 + 3] = 255;
        }
    }
    return { width, height, pixels: out };
}

/**
 * Decompresses a RAW3 (uncompressed ARGB8888) BLP image to RGBA pixel data.
 * @param data - The ARGB8888 image data.
 * @param width - The width of the image in pixels.
 * @param height - The height of the image in pixels.
 * @returns A DecodedImage object containing width, height, and RGBA pixel data.
 */
export function decompressRAW3(data: Uint8Array, width: number, height: number): DecodedImage {
    const numPixels = width * height;
    const out = new Uint8Array(numPixels * 4);
    for (let i = 0; i < numPixels; i++) {
        out[i * 4 + 0] = data[i * 4 + 2]; // R
        out[i * 4 + 1] = data[i * 4 + 1]; // G
        out[i * 4 + 2] = data[i * 4 + 0]; // B
        out[i * 4 + 3] = data[i * 4 + 3]; // A
    }
    return { width, height, pixels: out };
}

/**
 * Generates a color palette from RGBA pixel data using a simple approach.
 * @param pixels - RGBA pixel data.
 * @param maxColors - Maximum number of colors in the palette (default: 256).
 * @returns An object containing the palette and color indices.
 */
export function generatePalette(pixels: Uint8Array, maxColors: number = 256): { palette: Uint8Array; indices: Uint8Array } {
    const colorMap = new Map<string, number>();
    const rgbPalette: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const key = `${r},${g},${b}`;

        if (!colorMap.has(key)) {
            colorMap.set(key, rgbPalette.length / 3);
            rgbPalette.push(r, g, b);
        }

        indices.push(colorMap.get(key)!);
    }

    if (rgbPalette.length / 3 > maxColors) {
        const step = Math.floor(rgbPalette.length / 3 / maxColors);
        const reducedPalette: number[] = [];
        const newColorMap = new Map<string, number>();

        for (let i = 0; i < maxColors; i++) {
            const idx = i * step;
            const r = rgbPalette[idx * 3];
            const g = rgbPalette[idx * 3 + 1];
            const b = rgbPalette[idx * 3 + 2];
            const key = `${r},${g},${b}`;

            newColorMap.set(key, i);
            reducedPalette.push(r, g, b);
        }

        const newIndices: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            let closestIdx = 0;
            let minDistance = Infinity;

            for (let j = 0; j < reducedPalette.length; j += 3) {
                const pr = reducedPalette[j];
                const pg = reducedPalette[j + 1];
                const pb = reducedPalette[j + 2];

                const distance = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIdx = j / 3;
                }
            }

            newIndices.push(closestIdx);
        }

        return {
            palette: new Uint8Array(reducedPalette),
            indices: new Uint8Array(newIndices),
        };
    }

    return {
        palette: new Uint8Array(rgbPalette),
        indices: new Uint8Array(indices),
    };
}

/**
 * Compresses an image to palettized format (RAW1).
 * @param image - The image to compress.
 * @param alphaSize - The alpha channel bit depth (0, 1, 4, or 8).
 * @returns Compressed data including palette indices and alpha data.
 */
export function compressRAW1(image: DecodedImage, alphaSize: number = 8): Uint8Array {
    const { width, height, pixels } = image;
    const numPixels = width * height;

    const { indices } = generatePalette(pixels, 256);

    let alphaDataSize = 0;
    if (alphaSize === 8) {
        alphaDataSize = numPixels;
    } else if (alphaSize === 4) {
        alphaDataSize = Math.ceil(numPixels / 2);
    } else if (alphaSize === 1) {
        alphaDataSize = Math.ceil(numPixels / 8);
    }

    const compressed = new Uint8Array(numPixels + alphaDataSize);

    compressed.set(indices, 0);

    if (alphaSize > 0) {
        const alphaData = new Uint8Array(alphaDataSize);
        let alphaOffset = 0;

        for (let i = 0; i < numPixels; i++) {
            const alpha = pixels[i * 4 + 3];

            if (alphaSize === 8) {
                alphaData[alphaOffset++] = alpha;
            } else if (alphaSize === 4) {
                const alpha4 = Math.round(alpha / 17);
                const byteIndex = Math.floor(i / 2);
                const bitOffset = (i % 2) * 4;

                if (bitOffset === 0) {
                    alphaData[byteIndex] = alpha4;
                } else {
                    alphaData[byteIndex] |= alpha4 << 4;
                }
            } else if (alphaSize === 1) {
                const alpha1 = alpha > 127 ? 1 : 0;
                const byteIndex = Math.floor(i / 8);
                const bitOffset = i % 8;

                if (bitOffset === 0) {
                    alphaData[byteIndex] = alpha1;
                } else {
                    alphaData[byteIndex] |= alpha1 << bitOffset;
                }
            }
        }

        compressed.set(alphaData, numPixels);
    }

    return compressed;
}

/**
 * Compresses an image to uncompressed ARGB8888 format (RAW3).
 * @param image - The image to compress.
 * @returns Uncompressed ARGB8888 data.
 */
export function compressRAW3(image: DecodedImage): Uint8Array {
    const { width, height, pixels } = image;
    const numPixels = width * height;
    const compressed = new Uint8Array(numPixels * 4);

    for (let i = 0; i < numPixels; i++) {
        compressed[i * 4 + 0] = pixels[i * 4 + 2];
        compressed[i * 4 + 1] = pixels[i * 4 + 1];
        compressed[i * 4 + 2] = pixels[i * 4 + 0];
        compressed[i * 4 + 3] = pixels[i * 4 + 3];
    }

    return compressed;
}
