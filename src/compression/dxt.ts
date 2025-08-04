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

/**
 * Converts a 24-bit RGB888 color to 16-bit RGB565.
 * @param r - The 8-bit red component.
 * @param g - The 8-bit green component.
 * @param b - The 8-bit blue component.
 * @returns The 16-bit RGB565 color value.
 */
function rgb888ToRgb565(r: number, g: number, b: number): number {
    const r5 = (r * 31 / 255) & 0x1f;
    const g6 = (g * 63 / 255) & 0x3f;
    const b5 = (b * 31 / 255) & 0x1f;
    return (r5 << 11) | (g6 << 5) | b5;
}

/**
 * Finds the best two colors for DXT compression using a simple approach.
 * @param pixels - RGBA pixel data for a 4x4 block.
 * @returns An array of two RGB565 colors.
 */
function findBestColors(pixels: Uint8Array): [number, number] {
    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;

    for (let i = 0; i < 16; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];

        minR = Math.min(minR, r);
        minG = Math.min(minG, g);
        minB = Math.min(minB, b);
        maxR = Math.max(maxR, r);
        maxG = Math.max(maxG, g);
        maxB = Math.max(maxB, b);
    }

    const color0 = rgb888ToRgb565(maxR, maxG, maxB);
    const color1 = rgb888ToRgb565(minR, minG, minB);

    return [color0, color1];
}

/**
 * Compresses a 4x4 RGBA block to DXT1 format.
 * @param pixels - RGBA pixel data for a 4x4 block (64 bytes).
 * @returns DXT1 compressed block data (8 bytes).
 */
export function compressDXT1Block(pixels: Uint8Array): Uint8Array {
    const [color0, color1] = findBestColors(pixels);
    const block = new Uint8Array(8);

    block[0] = color0 & 0xff;
    block[1] = (color0 >> 8) & 0xff;
    block[2] = color1 & 0xff;
    block[3] = (color1 >> 8) & 0xff;

    const [r0, g0, b0] = rgb565ToRgb888(color0);
    const [r1, g1, b1] = rgb565ToRgb888(color1);

    const palette: [number, number, number][] = [
        [r0, g0, b0],
        [r1, g1, b1],
        [0, 0, 0],
        [0, 0, 0],
    ];

    if (color0 > color1) {
        palette[2] = [
            Math.round((2 * r0 + r1) / 3),
            Math.round((2 * g0 + g1) / 3),
            Math.round((2 * b0 + b1) / 3),
        ];
        palette[3] = [
            Math.round((r0 + 2 * r1) / 3),
            Math.round((g0 + 2 * g1) / 3),
            Math.round((b0 + 2 * b1) / 3),
        ];
    } else {
        palette[2] = [
            Math.round((r0 + r1) / 2),
            Math.round((g0 + g1) / 2),
            Math.round((b0 + b1) / 2),
        ];
        palette[3] = [0, 0, 0];
    }

    let colorBits = 0;
    for (let i = 0; i < 16; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];

        let closestIdx = 0;
        let minDistance = Infinity;

        for (let j = 0; j < 4; j++) {
            const [pr, pg, pb] = palette[j];
            const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (distance < minDistance) {
                minDistance = distance;
                closestIdx = j;
            }
        }

        colorBits |= closestIdx << (2 * i);
    }

    block[4] = colorBits & 0xff;
    block[5] = (colorBits >> 8) & 0xff;
    block[6] = (colorBits >> 16) & 0xff;
    block[7] = (colorBits >> 24) & 0xff;

    return block;
}

/**
 * Compresses a 4x4 RGBA block to DXT3 format.
 * @param pixels - RGBA pixel data for a 4x4 block (64 bytes).
 * @returns DXT3 compressed block data (16 bytes).
 */
export function compressDXT3Block(pixels: Uint8Array): Uint8Array {
    const block = new Uint8Array(16);

    for (let i = 0; i < 16; i++) {
        const alpha = pixels[i * 4 + 3];
        const alpha4 = Math.round(alpha / 17);

        const byteIndex = Math.floor(i / 2);
        const bitOffset = (i % 2) * 4;

        if (bitOffset === 0) {
            block[byteIndex] = alpha4;
        } else {
            block[byteIndex] |= alpha4 << 4;
        }
    }

    const colorBlock = compressDXT1Block(pixels);
    block.set(colorBlock, 8);

    return block;
}

/**
 * Compresses a 4x4 RGBA block to DXT5 format.
 * @param pixels - RGBA pixel data for a 4x4 block (64 bytes).
 * @returns DXT5 compressed block data (16 bytes).
 */
export function compressDXT5Block(pixels: Uint8Array): Uint8Array {
    const block = new Uint8Array(16);

    let minAlpha = 255, maxAlpha = 0;
    for (let i = 0; i < 16; i++) {
        const alpha = pixels[i * 4 + 3];
        minAlpha = Math.min(minAlpha, alpha);
        maxAlpha = Math.max(maxAlpha, alpha);
    }

    block[0] = maxAlpha;
    block[1] = minAlpha;

    const alphaPalette = buildAlphaPalette(maxAlpha, minAlpha);

    let alphaBits = BigInt(0);
    for (let i = 0; i < 16; i++) {
        const alpha = pixels[i * 4 + 3];

        let closestIdx = 0;
        let minDistance = Infinity;

        for (let j = 0; j < 8; j++) {
            const distance = Math.abs(alpha - alphaPalette[j]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIdx = j;
            }
        }

        alphaBits |= BigInt(closestIdx) << BigInt(3 * i);
    }

    for (let i = 0; i < 6; i++) {
        block[2 + i] = Number((alphaBits >> BigInt(8 * i)) & BigInt(0xff));
    }

    const colorBlock = compressDXT1Block(pixels);
    block.set(colorBlock, 8);

    return block;
}

/**
 * Compresses an image to DXT1 format.
 * @param image - The image to compress.
 * @returns DXT1 compressed data.
 */
export function compressDXT1(image: DecodedImage): Uint8Array {
    const { width, height, pixels } = image;
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    const blockSize = 8;
    const compressed = new Uint8Array(blocksWide * blocksHigh * blockSize);

    let offset = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const blockPixels = new Uint8Array(64);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const srcX = bx * 4 + px;
                    const srcY = by * 4 + py;
                    const srcIdx = (srcY * width + srcX) * 4;
                    const dstIdx = (py * 4 + px) * 4;

                    if (srcX < width && srcY < height) {
                        blockPixels[dstIdx] = pixels[srcIdx]; // R
                        blockPixels[dstIdx + 1] = pixels[srcIdx + 1]; // G
                        blockPixels[dstIdx + 2] = pixels[srcIdx + 2]; // B
                        blockPixels[dstIdx + 3] = pixels[srcIdx + 3]; // A
                    } else {
                        blockPixels[dstIdx] = 0; // R
                        blockPixels[dstIdx + 1] = 0; // G
                        blockPixels[dstIdx + 2] = 0; // B
                        blockPixels[dstIdx + 3] = 0; // A
                    }
                }
            }

            const compressedBlock = compressDXT1Block(blockPixels);
            compressed.set(compressedBlock, offset);
            offset += blockSize;
        }
    }

    return compressed;
}

/**
 * Compresses an image to DXT3 format.
 * @param image - The image to compress.
 * @returns DXT3 compressed data.
 */
export function compressDXT3(image: DecodedImage): Uint8Array {
    const { width, height, pixels } = image;
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    const blockSize = 16;
    const compressed = new Uint8Array(blocksWide * blocksHigh * blockSize);

    let offset = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const blockPixels = new Uint8Array(64);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const srcX = bx * 4 + px;
                    const srcY = by * 4 + py;
                    const srcIdx = (srcY * width + srcX) * 4;
                    const dstIdx = (py * 4 + px) * 4;

                    if (srcX < width && srcY < height) {
                        blockPixels[dstIdx] = pixels[srcIdx]; // R
                        blockPixels[dstIdx + 1] = pixels[srcIdx + 1]; // G
                        blockPixels[dstIdx + 2] = pixels[srcIdx + 2]; // B
                        blockPixels[dstIdx + 3] = pixels[srcIdx + 3]; // A
                    } else {
                        blockPixels[dstIdx] = 0; // R
                        blockPixels[dstIdx + 1] = 0; // G
                        blockPixels[dstIdx + 2] = 0; // B
                        blockPixels[dstIdx + 3] = 0; // A
                    }
                }
            }

            const compressedBlock = compressDXT3Block(blockPixels);
            compressed.set(compressedBlock, offset);
            offset += blockSize;
        }
    }

    return compressed;
}

/**
 * Compresses an image to DXT5 format.
 * @param image - The image to compress.
 * @returns DXT5 compressed data.
 */
export function compressDXT5(image: DecodedImage): Uint8Array {
    const { width, height, pixels } = image;
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);
    const blockSize = 16;
    const compressed = new Uint8Array(blocksWide * blocksHigh * blockSize);

    let offset = 0;
    for (let by = 0; by < blocksHigh; by++) {
        for (let bx = 0; bx < blocksWide; bx++) {
            const blockPixels = new Uint8Array(64);
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    const srcX = bx * 4 + px;
                    const srcY = by * 4 + py;
                    const srcIdx = (srcY * width + srcX) * 4;
                    const dstIdx = (py * 4 + px) * 4;

                    if (srcX < width && srcY < height) {
                        blockPixels[dstIdx] = pixels[srcIdx]; // R
                        blockPixels[dstIdx + 1] = pixels[srcIdx + 1]; // G
                        blockPixels[dstIdx + 2] = pixels[srcIdx + 2]; // B
                        blockPixels[dstIdx + 3] = pixels[srcIdx + 3]; // A
                    } else {
                        blockPixels[dstIdx] = 0; // R
                        blockPixels[dstIdx + 1] = 0; // G
                        blockPixels[dstIdx + 2] = 0; // B
                        blockPixels[dstIdx + 3] = 0; // A
                    }
                }
            }

            const compressedBlock = compressDXT5Block(blockPixels);
            compressed.set(compressedBlock, offset);
            offset += blockSize;
        }
    }

    return compressed;
}
