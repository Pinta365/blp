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