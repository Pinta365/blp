import type { DecodedImage } from "../core/types.ts";
import { BLPColorEncoding, BLPPixelFormat } from "../core/types.ts";
import { compressDXT1, compressDXT3, compressDXT5 } from "../compression/dxt.ts";
import { compressRAW1, compressRAW3, generatePalette } from "../compression/palette.ts";
import { autoResizeToPowerOf2, ResizeMode } from "../utils/resize.ts";

/**
 * BLP encoding options
 */
export interface BLPEncodeOptions {
    /** Compression type (default: DXT) */
    compression?: BLPColorEncoding;
    /** Alpha channel bit depth (default: 8) */
    alphaSize?: number;
    /** Preferred format for DXT (default: 0 for DXT1) */
    preferredFormat?: number;
    /** Whether to generate mipmaps (default: false) */
    generateMipmaps?: boolean;
    /** DXT format to use when compression is DXT (default: DXT1) */
    dxtFormat?: BLPPixelFormat;
    /** Resizing mode for non-power-of-2 images (default: PAD_CENTER) */
    resizeMode?: ResizeMode;
    /** Whether to prefer larger power-of-2 dimensions when resizing (default: false) */
    preferLargerResize?: boolean;
    /** Whether to auto-resize non-power-of-2 images (default: true) */
    autoResize?: boolean;
    /** Fill color for padding (RGBA values 0-255, default: transparent) */
    fillColor?: { r: number; g: number; b: number; a: number };
}

/**
 * Default BLP encoding options
 */
const DEFAULT_OPTIONS: Required<BLPEncodeOptions> = {
    compression: BLPColorEncoding.DXT,
    alphaSize: 8,
    preferredFormat: BLPPixelFormat.DXT1,
    generateMipmaps: false,
    dxtFormat: BLPPixelFormat.DXT1,
    resizeMode: ResizeMode.PAD_CENTER,
    preferLargerResize: true,
    autoResize: true,
    fillColor: { r: 0, g: 0, b: 0, a: 0 },
};

/**
 * Generates mipmaps for an image
 */
function generateMipmaps(image: DecodedImage): DecodedImage[] {
    const mipmaps: DecodedImage[] = [image];
    let currentWidth = image.width;
    let currentHeight = image.height;
    let currentPixels = image.pixels;

    while (currentWidth > 1 && currentHeight > 1) {
        const newWidth = Math.max(1, currentWidth >> 1);
        const newHeight = Math.max(1, currentHeight >> 1);
        const newPixels = new Uint8Array(newWidth * newHeight * 4);

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const srcX = x * 2;
                const srcY = y * 2;

                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;

                for (let dy = 0; dy < 2 && srcY + dy < currentHeight; dy++) {
                    for (let dx = 0; dx < 2 && srcX + dx < currentWidth; dx++) {
                        const srcIdx = ((srcY + dy) * currentWidth + (srcX + dx)) * 4;
                        r += currentPixels[srcIdx];
                        g += currentPixels[srcIdx + 1];
                        b += currentPixels[srcIdx + 2];
                        a += currentPixels[srcIdx + 3];
                        count++;
                    }
                }

                const dstIdx = (y * newWidth + x) * 4;
                newPixels[dstIdx] = Math.round(r / count);
                newPixels[dstIdx + 1] = Math.round(g / count);
                newPixels[dstIdx + 2] = Math.round(b / count);
                newPixels[dstIdx + 3] = Math.round(a / count);
            }
        }

        mipmaps.push({
            width: newWidth,
            height: newHeight,
            pixels: newPixels,
        });

        currentWidth = newWidth;
        currentHeight = newHeight;
        currentPixels = newPixels;
    }

    return mipmaps;
}

/**
 * Writes a 32-bit little-endian integer to a buffer
 */
function writeUint32(buffer: Uint8Array, offset: number, value: number): void {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
    buffer[offset + 2] = (value >> 16) & 0xff;
    buffer[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Encodes a DecodedImage to BLP format.
 * @param image - The image to encode.
 * @param options - BLP encoding options.
 * @returns A Uint8Array containing the BLP file data.
 */
export function encodeToBLP(image: DecodedImage, options: BLPEncodeOptions = {}): Uint8Array {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if ((image.width & (image.width - 1)) !== 0 || (image.height & (image.height - 1)) !== 0) {
        if (opts.autoResize) {
            console.log(`⚠️  Auto-resizing image from ${image.width}x${image.height} to power-of-2 dimensions`);
            image = autoResizeToPowerOf2(image, opts.resizeMode, opts.preferLargerResize, opts.fillColor);
        } else {
            throw new Error("Image dimensions must be powers of 2. Enable autoResize option to automatically resize the image.");
        }
    }

    const mipmaps = opts.generateMipmaps ? generateMipmaps(image) : [image];

    let compression = opts.compression;
    let alphaSize = opts.alphaSize;
    let preferredFormat = opts.preferredFormat;

    if (compression === BLPColorEncoding.DXT) {
        const alphaValues = new Set<number>();
        for (let i = 3; i < image.pixels.length; i += 4) {
            alphaValues.add(image.pixels[i]);
        }

        const hasAlpha = alphaValues.has(0) || alphaValues.has(255);
        const hasPartialAlpha = Array.from(alphaValues).some((a) => a > 0 && a < 255);
        const isBinaryAlpha = alphaValues.size <= 2 && (alphaValues.has(0) && alphaValues.has(255));

        if (opts.dxtFormat === BLPPixelFormat.DXT3) {
            compression = BLPColorEncoding.DXT;
            alphaSize = 8;
            preferredFormat = BLPPixelFormat.DXT3;
        } else if (opts.dxtFormat === BLPPixelFormat.DXT5) {
            compression = BLPColorEncoding.DXT;
            alphaSize = 8;
            preferredFormat = BLPPixelFormat.DXT5;
        } else if (hasPartialAlpha) {
            if (opts.preferredFormat === BLPPixelFormat.DXT3) {
                compression = BLPColorEncoding.DXT;
                alphaSize = 8;
                preferredFormat = BLPPixelFormat.DXT3;
            } else if (opts.preferredFormat === BLPPixelFormat.DXT5) {
                compression = BLPColorEncoding.DXT;
                alphaSize = 8;
                preferredFormat = BLPPixelFormat.DXT5;
            } else {
                compression = BLPColorEncoding.DXT;
                alphaSize = 8;
                preferredFormat = BLPPixelFormat.DXT5;
            }
        } else if (hasAlpha && isBinaryAlpha) {
            compression = BLPColorEncoding.DXT;
            alphaSize = 1;
            preferredFormat = BLPPixelFormat.DXT1;
        } else {
            compression = BLPColorEncoding.DXT;
            alphaSize = 0;
            preferredFormat = BLPPixelFormat.DXT1;
        }
    }

    const headerSize = 0x94;
    const paletteSize = compression === BLPColorEncoding.PALETTE ? 1024 : 0;
    const headerAndPaletteSize = headerSize + paletteSize;

    const compressedMipmaps: Uint8Array[] = [];
    let currentOffset = headerAndPaletteSize;

    for (const mipmap of mipmaps) {
        let compressedData: Uint8Array;

        switch (compression) {
            case BLPColorEncoding.PALETTE:
                compressedData = compressRAW1(mipmap, alphaSize);
                break;
            case BLPColorEncoding.DXT:
                if (preferredFormat === BLPPixelFormat.DXT3) {
                    compressedData = compressDXT3(mipmap);
                } else if (preferredFormat === BLPPixelFormat.DXT5) {
                    compressedData = compressDXT5(mipmap);
                } else {
                    compressedData = compressDXT1(mipmap);
                }
                break;
            case BLPColorEncoding.ARGB8888:
                compressedData = compressRAW3(mipmap);
                break;
            default:
                throw new Error(`Unsupported compression type: ${compression}`);
        }

        compressedMipmaps.push(compressedData);
        currentOffset += compressedData.length;
    }

    const totalSize = headerAndPaletteSize + compressedMipmaps.reduce((sum, data) => sum + data.length, 0);
    const blpData = new Uint8Array(totalSize);

    const magic = new TextEncoder().encode("BLP2");
    blpData.set(magic, 0);
    writeUint32(blpData, 4, 1);
    blpData[8] = compression;
    blpData[9] = alphaSize;
    blpData[10] = preferredFormat;
    blpData[11] = opts.generateMipmaps ? 1 : 0;
    writeUint32(blpData, 12, image.width);
    writeUint32(blpData, 16, image.height);

    let offset = headerAndPaletteSize;
    for (let i = 0; i < 16; i++) {
        if (i < compressedMipmaps.length) {
            writeUint32(blpData, 20 + i * 4, offset);
            writeUint32(blpData, 84 + i * 4, compressedMipmaps[i].length);
            offset += compressedMipmaps[i].length;
        } else {
            writeUint32(blpData, 20 + i * 4, 0);
            writeUint32(blpData, 84 + i * 4, 0);
        }
    }

    if (compression === BLPColorEncoding.PALETTE) {
        const { palette } = generatePalette(image.pixels, 256);

        const rgbaPalette = new Uint8Array(1024);
        for (let i = 0; i < 256; i++) {
            rgbaPalette[i * 4 + 0] = palette[i * 3 + 0];
            rgbaPalette[i * 4 + 1] = palette[i * 3 + 1];
            rgbaPalette[i * 4 + 2] = palette[i * 3 + 2];
            rgbaPalette[i * 4 + 3] = 255;
        }

        blpData.set(rgbaPalette, headerSize);
    }

    offset = headerAndPaletteSize;
    for (const compressedData of compressedMipmaps) {
        blpData.set(compressedData, offset);
        offset += compressedData.length;
    }

    return blpData;
}

/**
 * Convenience function to encode as DXT1 BLP
 */
export function encodeToDXT1BLP(image: DecodedImage, generateMipmaps: boolean = false): Uint8Array {
    return encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        alphaSize: 0,
        preferredFormat: 0,
        generateMipmaps,
        dxtFormat: BLPPixelFormat.DXT1,
    });
}

/**
 * Convenience function to encode as DXT3 BLP
 */
export function encodeToDXT3BLP(image: DecodedImage, generateMipmaps: boolean = false): Uint8Array {
    return encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        alphaSize: 8,
        preferredFormat: 1,
        generateMipmaps,
        dxtFormat: BLPPixelFormat.DXT3,
    });
}

/**
 * Convenience function to encode as DXT5 BLP
 */
export function encodeToDXT5BLP(image: DecodedImage, generateMipmaps: boolean = false): Uint8Array {
    return encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        alphaSize: 8,
        preferredFormat: 7,
        generateMipmaps,
        dxtFormat: BLPPixelFormat.DXT5,
    });
}

/**
 * Convenience function to encode as palettized BLP
 */
export function encodeToPaletteBLP(image: DecodedImage, alphaSize: number = 8, generateMipmaps: boolean = false): Uint8Array {
    return encodeToBLP(image, {
        compression: BLPColorEncoding.PALETTE,
        alphaSize,
        generateMipmaps,
    });
}

/**
 * Convenience function to encode as uncompressed BLP
 */
export function encodeToUncompressedBLP(image: DecodedImage, generateMipmaps: boolean = false): Uint8Array {
    return encodeToBLP(image, {
        compression: BLPColorEncoding.ARGB8888,
        generateMipmaps,
    });
}
