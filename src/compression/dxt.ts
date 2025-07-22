import type { DecodedImage } from "../core/types.ts";

/**
 * Converts a 16-bit RGB565 color to 24-bit RGB888.
 * @param c - The 16-bit RGB565 color value.
 * @returns An array [r, g, b] with 8-bit color components.
 */
function rgb565ToRgb888(c: number): [number, number, number] {
    const r = ((c >> 11) & 0x1f) * 255 / 31;
    const g = ((c >> 5) & 0x3f) * 255 / 63;
    const b = (c & 0x1f) * 255 / 31;
    return [r, g, b].map(Math.round) as [number, number, number];
}

/**
 * Builds the alpha palette for DXT5 decompression from two alpha endpoints.
 * @param alpha0 - The first alpha endpoint (0-255).
 * @param alpha1 - The second alpha endpoint (0-255).
 * @returns An array of 8 alpha values for the block.
 */
function buildAlphaPalette(alpha0: number, alpha1: number): number[] {
    const alpha = [alpha0, alpha1];
    if (alpha0 > alpha1) {
        for (let i = 1; i <= 6; i++) {
            alpha[i + 1] = Math.round(((7 - i) * alpha0 + i * alpha1) / 7);
        }
    } else {
        for (let i = 1; i <= 4; i++) {
            alpha[i + 1] = Math.round(((5 - i) * alpha0 + i * alpha1) / 5);
        }
        alpha[6] = 0;
        alpha[7] = 255;
    }
    return alpha;
}

/**
 * Decompresses a DXT1-compressed image to RGBA pixel data.
 * @param data - The DXT1-compressed image data.
 * @param width - The width of the image in pixels.
 * @param height - The height of the image in pixels.
 * @returns A DecodedImage object containing width, height, and RGBA pixel data.
 */
export function decompressDXT1(data: Uint8Array, width: number, height: number): DecodedImage {
    const out = new Uint8Array(width * height * 4);
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    let src = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const color0 = data[src] | (data[src + 1] << 8);
            const color1 = data[src + 2] | (data[src + 3] << 8);
            const [r0, g0, b0] = rgb565ToRgb888(color0);
            const [r1, g1, b1] = rgb565ToRgb888(color1);
            const colorPalette: [number, number, number][] = [
                [r0, g0, b0],
                [r1, g1, b1],
                [0, 0, 0],
                [0, 0, 0],
            ];
            if (color0 > color1) {
                colorPalette[2] = [
                    Math.round((2 * r0 + r1) / 3),
                    Math.round((2 * g0 + g1) / 3),
                    Math.round((2 * b0 + b1) / 3),
                ];
                colorPalette[3] = [
                    Math.round((r0 + 2 * r1) / 3),
                    Math.round((g0 + 2 * g1) / 3),
                    Math.round((b0 + 2 * b1) / 3),
                ];
            } else {
                colorPalette[2] = [
                    Math.round((r0 + r1) / 2),
                    Math.round((g0 + g1) / 2),
                    Math.round((b0 + b1) / 2),
                ];
                colorPalette[3] = [0, 0, 0];
            }
            const colorBits = data[src + 4] |
                (data[src + 5] << 8) |
                (data[src + 6] << 16) |
                (data[src + 7] << 24);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const pixelX = bx * 4 + px;
                    const pixelY = by * 4 + py;
                    if (pixelX >= width || pixelY >= height) continue;
                    const pixelIndex = pixelY * width + pixelX;
                    const colorIndex = (colorBits >> (2 * (4 * py + px))) & 0x03;
                    const [r, g, b] = colorPalette[colorIndex];
                    let a = 255;
                    if (color0 <= color1 && colorIndex === 3) {
                        a = 0;
                    }
                    out[pixelIndex * 4 + 0] = r;
                    out[pixelIndex * 4 + 1] = g;
                    out[pixelIndex * 4 + 2] = b;
                    out[pixelIndex * 4 + 3] = a;
                }
            }
            src += 8;
        }
    }
    return { width, height, pixels: out };
}

/**
 * Decompresses a DXT3-compressed image to RGBA pixel data.
 * @param data - The DXT3-compressed image data.
 * @param width - The width of the image in pixels.
 * @param height - The height of the image in pixels.
 * @returns A DecodedImage object containing width, height, and RGBA pixel data.
 */
export function decompressDXT3(data: Uint8Array, width: number, height: number): DecodedImage {
    const out = new Uint8Array(width * height * 4);
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    let src = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const alphaBytes = data.subarray(src, src + 8);
            const color0 = data[src + 8] | (data[src + 9] << 8);
            const color1 = data[src + 10] | (data[src + 11] << 8);
            const [r0, g0, b0] = rgb565ToRgb888(color0);
            const [r1, g1, b1] = rgb565ToRgb888(color1);
            const colorPalette: [number, number, number][] = [
                [r0, g0, b0],
                [r1, g1, b1],
                [
                    Math.round((2 * r0 + r1) / 3),
                    Math.round((2 * g0 + g1) / 3),
                    Math.round((2 * b0 + b1) / 3),
                ],
                [
                    Math.round((r0 + 2 * r1) / 3),
                    Math.round((g0 + 2 * g1) / 3),
                    Math.round((b0 + 2 * b1) / 3),
                ],
            ];
            const colorBits = data[src + 12] |
                (data[src + 13] << 8) |
                (data[src + 14] << 16) |
                (data[src + 15] << 24);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const pixelX = bx * 4 + px;
                    const pixelY = by * 4 + py;
                    if (pixelX >= width || pixelY >= height) continue;
                    const pixelIndex = pixelY * width + pixelX;
                    const alphaIndex = 4 * (4 * py + px);
                    const alphaByte = alphaBytes[Math.floor(alphaIndex / 8)];
                    const a = ((alphaByte >> (alphaIndex % 8)) & 0x0F) * 17;
                    const colorIndex = (colorBits >> (2 * (4 * py + px))) & 0x03;
                    const [r, g, b] = colorPalette[colorIndex];
                    out[pixelIndex * 4 + 0] = r;
                    out[pixelIndex * 4 + 1] = g;
                    out[pixelIndex * 4 + 2] = b;
                    out[pixelIndex * 4 + 3] = a;
                }
            }
            src += 16;
        }
    }
    return { width, height, pixels: out };
}

/**
 * Decompresses a DXT5-compressed image to RGBA pixel data.
 * @param data - The DXT5-compressed image data.
 * @param width - The width of the image in pixels.
 * @param height - The height of the image in pixels.
 * @returns A DecodedImage object containing width, height, and RGBA pixel data.
 */
export function decompressDXT5(data: Uint8Array, width: number, height: number): DecodedImage {
    const out = new Uint8Array(width * height * 4);
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    let src = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const alpha0 = data[src];
            const alpha1 = data[src + 1];
            const alphaBits = data[src + 2] |
                (data[src + 3] << 8) |
                (data[src + 4] << 16) |
                (data[src + 5] << 24) |
                (data[src + 6] * 0x100000000) |
                (data[src + 7] * 0x10000000000);
            const alphaPalette = buildAlphaPalette(alpha0, alpha1);
            const color0 = data[src + 8] | (data[src + 9] << 8);
            const color1 = data[src + 10] | (data[src + 11] << 8);
            const [r0, g0, b0] = rgb565ToRgb888(color0);
            const [r1, g1, b1] = rgb565ToRgb888(color1);
            const colorPalette = [
                [r0, g0, b0],
                [r1, g1, b1],
                [
                    Math.round((2 * r0 + r1) / 3),
                    Math.round((2 * g0 + g1) / 3),
                    Math.round((2 * b0 + b1) / 3),
                ],
                [
                    Math.round((r0 + 2 * r1) / 3),
                    Math.round((g0 + 2 * g1) / 3),
                    Math.round((b0 + 2 * b1) / 3),
                ],
            ];
            const colorBits = data[src + 12] |
                (data[src + 13] << 8) |
                (data[src + 14] << 16) |
                (data[src + 15] << 24);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const pixelX = bx * 4 + px;
                    const pixelY = by * 4 + py;
                    if (pixelX >= width || pixelY >= height) continue;
                    const pixelIndex = pixelY * width + pixelX;
                    const colorIndex = (colorBits >> (2 * (4 * py + px))) & 0x03;
                    const [r, g, b] = colorPalette[colorIndex];
                    const alphaIndex = (alphaBits >> (3 * (4 * py + px))) & 0x07;
                    const a = alphaPalette[alphaIndex];
                    out[pixelIndex * 4 + 0] = r;
                    out[pixelIndex * 4 + 1] = g;
                    out[pixelIndex * 4 + 2] = b;
                    out[pixelIndex * 4 + 3] = a;
                }
            }
            src += 16;
        }
    }
    return { width, height, pixels: out };
}
