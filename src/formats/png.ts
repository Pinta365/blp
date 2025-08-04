import type { DecodedImage } from "../core/types.ts";
import { uint8ArrayToStream } from "../utils/streams.ts";

/**
 * PNG color types as defined in the specification
 */
export enum PNGColorType {
    GRAYSCALE = 0,
    RGB = 2,
    PALETTE = 3,
    GRAYSCALE_ALPHA = 4,
    RGBA = 6,
}

/**
 * PNG encoding options
 */
export interface PNGEncodeOptions {
    /** Color type to use for encoding */
    colorType?: PNGColorType;
    /** Bit depth (1, 2, 4, 8, or 16) */
    bitDepth?: number;
    /** Custom palette for palette-based images */
    palette?: Uint8Array;

    /** Compression level (0-9, higher = better compression but slower) */
    compressionLevel?: number;
}

/**
 * Default PNG encoding options
 */
const DEFAULT_OPTIONS: Required<PNGEncodeOptions> = {
    colorType: PNGColorType.RGBA,
    bitDepth: 8,
    palette: new Uint8Array(0),
    compressionLevel: 6,
};

/**
 * Valid bit depths for each color type according to PNG spec
 */
const VALID_BIT_DEPTHS: Record<PNGColorType, number[]> = {
    [PNGColorType.GRAYSCALE]: [1, 2, 4, 8, 16],
    [PNGColorType.RGB]: [8, 16],
    [PNGColorType.PALETTE]: [1, 2, 4, 8],
    [PNGColorType.GRAYSCALE_ALPHA]: [8, 16],
    [PNGColorType.RGBA]: [8, 16],
};

/**
 * Writes a PNG chunk with the given type and data, including CRC.
 * @param type - The 4-character chunk type (e.g., 'IHDR', 'IDAT').
 * @param data - The chunk data as a Uint8Array.
 * @returns The complete chunk as a Uint8Array.
 */
function writeChunk(type: string, data: Uint8Array): Uint8Array {
    const crcTable = (() => {
        let c;
        const table = [];
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c;
        }
        return table;
    })();

    function crc32(buf: Uint8Array) {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
    }

    const typeBytes = new TextEncoder().encode(type);
    const length = data.length;
    const chunk = new Uint8Array(8 + length + 4);
    chunk[0] = (length >>> 24) & 0xff;
    chunk[1] = (length >>> 16) & 0xff;
    chunk[2] = (length >>> 8) & 0xff;
    chunk[3] = length & 0xff;
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    const crc = crc32(new Uint8Array([...typeBytes, ...data]));
    chunk[8 + length + 0] = (crc >>> 24) & 0xff;
    chunk[8 + length + 1] = (crc >>> 16) & 0xff;
    chunk[8 + length + 2] = (crc >>> 8) & 0xff;
    chunk[8 + length + 3] = crc & 0xff;
    return chunk;
}

/**
 * Converts RGBA pixels to grayscale with bit depth support
 */
function rgbaToGrayscale(pixels: Uint8Array, bitDepth: number): Uint8Array {
    const maxValue = (1 << bitDepth) - 1;
    const scale = maxValue / 255;

    if (bitDepth <= 8) {
        const result = new Uint8Array(pixels.length / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 4] = Math.min(Math.round(gray * scale), maxValue);
        }

        return result;
    } else {
        // 16-bit grayscale
        const result = new Uint16Array(pixels.length / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 4] = Math.min(Math.round(gray * 257), 65535); // Scale 0-255 to 0-65535
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Converts RGBA pixels to RGB with bit depth support
 */
function rgbaToRgb(pixels: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        const result = new Uint8Array(pixels.length * 3 / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            result[i * 3 / 4] = pixels[i]; // R
            result[i * 3 / 4 + 1] = pixels[i + 1]; // G
            result[i * 3 / 4 + 2] = pixels[i + 2]; // B
        }

        return result;
    } else {
        const result = new Uint16Array(pixels.length * 3 / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            result[i * 3 / 4] = pixels[i] * 257; // R
            result[i * 3 / 4 + 1] = pixels[i + 1] * 257; // G
            result[i * 3 / 4 + 2] = pixels[i + 2] * 257; // B
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Converts RGBA pixels to grayscale with alpha with bit depth support
 */
function rgbaToGrayscaleAlpha(pixels: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        const result = new Uint8Array(pixels.length / 2);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 2] = gray;
            result[i / 2 + 1] = pixels[i + 3];
        }

        return result;
    } else {
        const result = new Uint16Array(pixels.length / 2);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 2] = gray * 257;
            result[i / 2 + 1] = pixels[i + 3] * 257;
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Upsamples RGBA from 8-bit to 16-bit for PNG encoding
 */
function upsampleRGBA8ToRGBA16(pixels: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        return pixels;
    } else {
        const result = new Uint16Array(pixels.length);

        for (let i = 0; i < pixels.length; i++) {
            result[i] = pixels[i] * 257;
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Creates a palette from RGBA pixels and converts to palette-based format
 */
function rgbaToPalette(pixels: Uint8Array, bitDepth: number, customPalette?: Uint8Array): { palette: Uint8Array; indices: Uint8Array } {
    const maxColors = 1 << bitDepth;

    if (customPalette && customPalette.length > 0) {
        const paletteColors = customPalette.length / 3;
        if (paletteColors > maxColors) {
            throw new Error(`Custom palette has ${paletteColors} colors, but bit depth ${bitDepth} only supports ${maxColors} colors`);
        }

        const indices: number[] = [];

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            let closestIdx = 0;
            let minDistance = Infinity;

            for (let j = 0; j < customPalette.length; j += 3) {
                const pr = customPalette[j];
                const pg = customPalette[j + 1];
                const pb = customPalette[j + 2];

                const distance = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIdx = j / 3;
                }
            }

            indices.push(closestIdx);
        }

        return {
            palette: customPalette,
            indices: new Uint8Array(indices),
        };
    }

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
 * Packs pixels for low bit depths (1, 2, 4 bits)
 */
function packPixels(pixels: Uint8Array, bitDepth: number): Uint8Array {
    const pixelsPerByte = 8 / bitDepth;
    const packedLength = Math.ceil(pixels.length / pixelsPerByte);
    const packed = new Uint8Array(packedLength);

    for (let i = 0; i < pixels.length; i++) {
        const byteIndex = Math.floor(i / pixelsPerByte);
        const bitOffset = (i % pixelsPerByte) * bitDepth;
        packed[byteIndex] |= (pixels[i] & ((1 << bitDepth) - 1)) << bitOffset;
    }

    return packed;
}

/**
 * Applies PNG filters to image data
 */
function applyFilters(data: Uint8Array, width: number, channels: number): Uint8Array {
    const height = data.length / (width * channels);
    const filtered = new Uint8Array(data.length + height);

    for (let y = 0; y < height; y++) {
        const rowStart = y * width * channels;
        const filteredRowStart = y * (width * channels + 1);

        filtered[filteredRowStart] = 0;

        for (let x = 0; x < width * channels; x++) {
            filtered[filteredRowStart + 1 + x] = data[rowStart + x];
        }
    }

    return filtered;
}

/**
 * Encodes a DecodedImage to PNG format with various color types and bit depths.
 * @param image - The DecodedImage to encode.
 * @param options - PNG encoding options.
 * @returns A Promise resolving to a Uint8Array containing the PNG file data.
 */
export async function encodeToPNG(
    image: DecodedImage,
    options: PNGEncodeOptions = {},
): Promise<Uint8Array> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { width, height, pixels } = image;

    // Validate options
    if (!VALID_BIT_DEPTHS[opts.colorType].includes(opts.bitDepth)) {
        throw new Error(`Invalid bit depth ${opts.bitDepth} for color type ${opts.colorType}`);
    }

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    // Create IHDR chunk
    const ihdr = new Uint8Array(13);
    ihdr[0] = (width >>> 24) & 0xff;
    ihdr[1] = (width >>> 16) & 0xff;
    ihdr[2] = (width >>> 8) & 0xff;
    ihdr[3] = width & 0xff;
    ihdr[4] = (height >>> 24) & 0xff;
    ihdr[5] = (height >>> 16) & 0xff;
    ihdr[6] = (height >>> 8) & 0xff;
    ihdr[7] = height & 0xff;
    ihdr[8] = opts.bitDepth;
    ihdr[9] = opts.colorType;
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const ihdrChunk = writeChunk("IHDR", ihdr);

    let imageData: Uint8Array;
    let channels: number;
    let plteChunk: Uint8Array | undefined;

    switch (opts.colorType) {
        case PNGColorType.GRAYSCALE:
            imageData = rgbaToGrayscale(pixels, opts.bitDepth);
            channels = 1;
            if (opts.bitDepth < 8) {
                imageData = packPixels(imageData, opts.bitDepth);
            }
            break;

        case PNGColorType.RGB:
            imageData = rgbaToRgb(pixels, opts.bitDepth);
            channels = 3;
            break;

        case PNGColorType.PALETTE: {
            const paletteData = rgbaToPalette(pixels, opts.bitDepth, opts.palette);
            imageData = paletteData.indices;
            channels = 1;
            if (opts.bitDepth < 8) {
                imageData = packPixels(imageData, opts.bitDepth);
            }
            plteChunk = writeChunk("PLTE", paletteData.palette);
            break;
        }

        case PNGColorType.GRAYSCALE_ALPHA:
            imageData = rgbaToGrayscaleAlpha(pixels, opts.bitDepth);
            channels = 2;
            break;

        case PNGColorType.RGBA:
        default:
            imageData = upsampleRGBA8ToRGBA16(pixels, opts.bitDepth);
            channels = 4;
            break;
    }

    const filteredData = applyFilters(imageData, width, channels);

    // TODO: Implement compression level, does not respect compressionLevel option
    const cs = new CompressionStream("deflate");
    const compressed = await new Response(
        uint8ArrayToStream(filteredData).pipeThrough(cs),
    ).arrayBuffer();

    const idatChunk = writeChunk("IDAT", new Uint8Array(compressed));
    const iendChunk = writeChunk("IEND", new Uint8Array(0));

    let totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    if (opts.colorType === PNGColorType.PALETTE) {
        totalLen += plteChunk!.length;
    }

    const png = new Uint8Array(totalLen);
    let offset = 0;

    png.set(signature, offset);
    offset += signature.length;

    png.set(ihdrChunk, offset);
    offset += ihdrChunk.length;

    if (opts.colorType === PNGColorType.PALETTE) {
        png.set(plteChunk!, offset);
        offset += plteChunk!.length;
    }

    png.set(idatChunk, offset);
    offset += idatChunk.length;

    png.set(iendChunk, offset);

    return png;
}

/**
 * Convenience function to encode as grayscale PNG
 */
export async function encodeToGrayscalePNG(
    image: DecodedImage,
    bitDepth: number = 8,
): Promise<Uint8Array> {
    return await encodeToPNG(image, { colorType: PNGColorType.GRAYSCALE, bitDepth });
}

/**
 * Convenience function to encode as RGB PNG
 */
export async function encodeToRGBPNG(
    image: DecodedImage,
    bitDepth: number = 8,
): Promise<Uint8Array> {
    return await encodeToPNG(image, { colorType: PNGColorType.RGB, bitDepth });
}

/**
 * Convenience function to encode as palette-based PNG
 */
export async function encodeToPalettePNG(
    image: DecodedImage,
    bitDepth: number = 8,
): Promise<Uint8Array> {
    return await encodeToPNG(image, { colorType: PNGColorType.PALETTE, bitDepth });
}

/**
 * Convenience function to encode as grayscale with alpha PNG
 */
export async function encodeToGrayscaleAlphaPNG(
    image: DecodedImage,
    bitDepth: number = 8,
): Promise<Uint8Array> {
    return await encodeToPNG(image, { colorType: PNGColorType.GRAYSCALE_ALPHA, bitDepth });
}

/**
 * Auto-detection options for PNG encoding
 */
export interface PNGAutoOptions {
    /** Whether to prefer smaller file size over quality */
    preferSize?: boolean;
    /** Whether to preserve exact alpha values (vs optimizing) */
    preserveExactAlpha?: boolean;
    /** Maximum palette size for palette mode (default: 256) */
    maxPaletteSize?: number;
}

/**
 * Automatically detects the optimal PNG format based on image content analysis
 * @param image - The decoded image to analyze
 * @param options - Auto-detection options
 * @returns Optimal PNG encoding options
 */
export function detectOptimalPNGFormat(
    image: DecodedImage,
    options: PNGAutoOptions = {},
): PNGEncodeOptions {
    const opts = {
        preferSize: false,
        preserveExactAlpha: false,
        maxPaletteSize: 256,
        ...options,
    };

    const { pixels } = image;

    let hasAlpha = false;
    const alphaValues = new Set<number>();

    for (let i = 3; i < pixels.length; i += 4) {
        const alpha = pixels[i];
        alphaValues.add(alpha);
        if (alpha < 255) {
            hasAlpha = true;
        }
    }

    const colors = new Map<string, number>();
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        const key = `${r},${g},${b},${a}`;
        colors.set(key, (colors.get(key) || 0) + 1);
    }

    const uniqueColors = colors.size;
    const isGrayscale = analyzeGrayscale(pixels);
    const isBinaryAlpha = alphaValues.size <= 2 && hasAlpha;

    if (isGrayscale) {
        if (hasAlpha) {
            return {
                colorType: PNGColorType.GRAYSCALE_ALPHA,
                bitDepth: 8,
            };
        } else {
            return {
                colorType: PNGColorType.GRAYSCALE,
                bitDepth: 8,
            };
        }
    }

    // Check if palette mode would be beneficial
    if (uniqueColors <= opts.maxPaletteSize && opts.preferSize) {
        return {
            colorType: PNGColorType.PALETTE,
            bitDepth: 8,
        };
    }

    if (hasAlpha) {
        if (isBinaryAlpha && !opts.preserveExactAlpha) {
            return {
                colorType: PNGColorType.RGB,
                bitDepth: 8,
            };
        } else {
            return {
                colorType: PNGColorType.RGBA,
                bitDepth: 8,
            };
        }
    }

    return {
        colorType: PNGColorType.RGB,
        bitDepth: 8,
    };
}

/**
 * Helper function to determine if an image is grayscale
 */
function analyzeGrayscale(pixels: Uint8Array): boolean {
    const tolerance = 5; // Allow small variations for compression artifacts

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        if (maxDiff > tolerance) {
            return false;
        }
    }

    return true;
}

/**
 * Encodes an image to PNG using automatic format detection
 * @param image - The decoded image to encode
 * @param options - Auto-detection options
 * @returns PNG data as Uint8Array
 */
export async function encodeToPNGAuto(
    image: DecodedImage,
    options: PNGAutoOptions = {},
): Promise<Uint8Array> {
    const optimalOptions = detectOptimalPNGFormat(image, options);
    return await encodeToPNG(image, optimalOptions);
}

/**
 * PNG decoding options
 */
export interface PNGDecodeOptions {
    /** Whether to preserve alpha channel (default: true) */
    preserveAlpha?: boolean;
    /** Target bit depth for output (default: 8) */
    targetBitDepth?: number;
}

/**
 * Default PNG decoding options
 */
const DEFAULT_DECODE_OPTIONS: Required<PNGDecodeOptions> = {
    preserveAlpha: true,
    targetBitDepth: 8,
};

/**
 * Reads a PNG chunk from the data stream
 */
function readChunk(data: Uint8Array, offset: number): { type: string; data: Uint8Array; length: number; totalLength: number } {
    const view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
    const length = view.getUint32(0, false);
    const typeBytes = data.subarray(offset + 4, offset + 8);
    const type = new TextDecoder().decode(typeBytes);
    const chunkData = data.subarray(offset + 8, offset + 8 + length);
    const totalLength = 12 + length;

    return { type, data: chunkData, length, totalLength };
}

/**
 * Validates PNG CRC
 */
function validateCRC(data: Uint8Array, offset: number, length: number): boolean {
    const crcTable = (() => {
        let c;
        const table = [];
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c;
        }
        return table;
    })();

    function crc32(buf: Uint8Array) {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
    }

    const chunkData = data.subarray(offset, offset + length);
    const expectedCRC = new DataView(data.buffer, data.byteOffset + offset + length, 4).getUint32(0, false);
    const calculatedCRC = crc32(chunkData);

    return expectedCRC === calculatedCRC;
}

/**
 * Decompresses deflate data
 */
async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream("deflate");
    const decompressed = await new Response(
        new Blob([data]).stream().pipeThrough(ds),
    ).arrayBuffer();
    return new Uint8Array(decompressed);
}

/**
 * Removes PNG filters from image data
 */
function removeFilters(data: Uint8Array, width: number, channels: number): Uint8Array {
    const height = data.length / (width * channels + 1);
    const unfiltered = new Uint8Array(width * height * channels);

    for (let y = 0; y < height; y++) {
        const rowStart = y * (width * channels + 1);
        const filterType = data[rowStart];
        const filteredRow = data.subarray(rowStart + 1, rowStart + 1 + width * channels);
        const unfilteredRow = unfiltered.subarray(y * width * channels, (y + 1) * width * channels);

        switch (filterType) {
            case 0:
                unfilteredRow.set(filteredRow);
                break;
            case 1:
                for (let x = 0; x < width * channels; x++) {
                    const left = x >= channels ? unfilteredRow[x - channels] : 0;
                    unfilteredRow[x] = (filteredRow[x] + left) & 0xff;
                }
                break;
            case 2:
                for (let x = 0; x < width * channels; x++) {
                    const up = y > 0 ? unfiltered[(y - 1) * width * channels + x] : 0;
                    unfilteredRow[x] = (filteredRow[x] + up) & 0xff;
                }
                break;
            case 3:
                for (let x = 0; x < width * channels; x++) {
                    const left = x >= channels ? unfilteredRow[x - channels] : 0;
                    const up = y > 0 ? unfiltered[(y - 1) * width * channels + x] : 0;
                    unfilteredRow[x] = (filteredRow[x] + Math.floor((left + up) / 2)) & 0xff;
                }
                break;
            case 4:
                for (let x = 0; x < width * channels; x++) {
                    const left = x >= channels ? unfilteredRow[x - channels] : 0;
                    const up = y > 0 ? unfiltered[(y - 1) * width * channels + x] : 0;
                    const upLeft = (x >= channels && y > 0) ? unfiltered[(y - 1) * width * channels + x - channels] : 0;

                    let paeth = left + up - upLeft;
                    const paethLeft = Math.abs(paeth - left);
                    const paethUp = Math.abs(paeth - up);
                    const paethUpLeft = Math.abs(paeth - upLeft);

                    if (paethLeft <= paethUp && paethLeft <= paethUpLeft) {
                        paeth = left;
                    } else if (paethUp <= paethUpLeft) {
                        paeth = up;
                    } else {
                        paeth = upLeft;
                    }

                    unfilteredRow[x] = (filteredRow[x] + paeth) & 0xff;
                }
                break;
            default:
                throw new Error(`Unsupported PNG filter type: ${filterType}`);
        }
    }

    return unfiltered;
}

/**
 * Converts grayscale to RGBA
 */
function grayscaleToRGBA(data: Uint8Array, bitDepth: number): Uint8Array {
    const pixels = data.length;
    const out = new Uint8Array(pixels * 4);

    if (bitDepth <= 8) {
        for (let i = 0; i < pixels; i++) {
            const gray = data[i];
            out[i * 4 + 0] = gray; // R
            out[i * 4 + 1] = gray; // G
            out[i * 4 + 2] = gray; // B
            out[i * 4 + 3] = 255; // A
        }
    } else {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let i = 0; i < pixels; i++) {
            const gray = view.getUint16(i * 2, false) >> 8;
            out[i * 4 + 0] = gray; // R
            out[i * 4 + 1] = gray; // G
            out[i * 4 + 2] = gray; // B
            out[i * 4 + 3] = 255; // A
        }
    }

    return out;
}

/**
 * Converts RGB to RGBA
 */
function rgbToRGBA(data: Uint8Array, bitDepth: number): Uint8Array {
    const pixels = data.length / 3;
    const out = new Uint8Array(pixels * 4);

    if (bitDepth === 8) {
        for (let i = 0; i < pixels; i++) {
            out[i * 4 + 0] = data[i * 3 + 0]; // R
            out[i * 4 + 1] = data[i * 3 + 1]; // G
            out[i * 4 + 2] = data[i * 3 + 2]; // B
            out[i * 4 + 3] = 255; // A
        }
    } else {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let i = 0; i < pixels; i++) {
            out[i * 4 + 0] = view.getUint16(i * 6 + 0, false) >> 8;
            out[i * 4 + 1] = view.getUint16(i * 6 + 2, false) >> 8;
            out[i * 4 + 2] = view.getUint16(i * 6 + 4, false) >> 8;
            out[i * 4 + 3] = 255;
        }
    }

    return out;
}

/**
 * Converts grayscale with alpha to RGBA
 */
function grayscaleAlphaToRGBA(data: Uint8Array, bitDepth: number): Uint8Array {
    const pixels = data.length / 2;
    const out = new Uint8Array(pixels * 4);

    if (bitDepth === 8) {
        for (let i = 0; i < pixels; i++) {
            const gray = data[i * 2 + 0];
            const alpha = data[i * 2 + 1];
            out[i * 4 + 0] = gray; // R
            out[i * 4 + 1] = gray; // G
            out[i * 4 + 2] = gray; // B
            out[i * 4 + 3] = alpha; // A
        }
    } else {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let i = 0; i < pixels; i++) {
            const gray = view.getUint16(i * 4 + 0, false) >> 8;
            const alpha = view.getUint16(i * 4 + 2, false) >> 8;
            out[i * 4 + 0] = gray; // R
            out[i * 4 + 1] = gray; // G
            out[i * 4 + 2] = gray; // B
            out[i * 4 + 3] = alpha; // A
        }
    }

    return out;
}

/**
 * Downsamples RGBA from 16-bit to 8-bit for PNG decoding
 */
function downsampleRGBA16ToRGBA8(data: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        return data;
    } else {
        const pixels = data.length / 4;
        const out = new Uint8Array(pixels * 4);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        for (let i = 0; i < pixels; i++) {
            out[i * 4 + 0] = view.getUint16(i * 8 + 0, false) >> 8;
            out[i * 4 + 1] = view.getUint16(i * 8 + 2, false) >> 8;
            out[i * 4 + 2] = view.getUint16(i * 8 + 4, false) >> 8;
            out[i * 4 + 3] = view.getUint16(i * 8 + 6, false) >> 8;
        }

        return out;
    }
}

/**
 * Converts palette-based image to RGBA
 */
function paletteToRGBA(data: Uint8Array, palette: Uint8Array, bitDepth: number): Uint8Array {
    const pixels = data.length;
    const out = new Uint8Array(pixels * 4);

    let indices: Uint8Array;
    if (bitDepth < 8) {
        const pixelsPerByte = 8 / bitDepth;
        indices = new Uint8Array(pixels);
        for (let i = 0; i < pixels; i++) {
            const byteIndex = Math.floor(i / pixelsPerByte);
            const bitOffset = (i % pixelsPerByte) * bitDepth;
            indices[i] = (data[byteIndex] >> bitOffset) & ((1 << bitDepth) - 1);
        }
    } else {
        indices = data;
    }

    for (let i = 0; i < pixels; i++) {
        const palIdx = indices[i] * 3;
        out[i * 4 + 0] = palette[palIdx + 0];
        out[i * 4 + 1] = palette[palIdx + 1];
        out[i * 4 + 2] = palette[palIdx + 2];
        out[i * 4 + 3] = 255;
    }

    return out;
}

/**
 * Decodes a PNG file from a Uint8Array and returns the image as RGBA pixel data.
 * @param data - The PNG file data as a Uint8Array.
 * @param options - PNG decoding options.
 * @returns A Promise resolving to a DecodedImage object containing RGBA pixel data.
 * @throws If the file is invalid or unsupported.
 */
export async function decodePNGData(
    data: Uint8Array,
    options: PNGDecodeOptions = {},
): Promise<DecodedImage> {
    const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };

    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
        if (data[i] !== signature[i]) {
            throw new Error("Invalid PNG signature");
        }
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let palette: Uint8Array | null = null;
    let imageData: Uint8Array | null = null;

    while (offset < data.length) {
        const chunk = readChunk(data, offset);

        if (!validateCRC(data, offset + 4, chunk.length + 4)) {
            throw new Error(`Invalid CRC for chunk: ${chunk.type}`);
        }

        switch (chunk.type) {
            case "IHDR": {
                if (chunk.length !== 13) {
                    throw new Error("Invalid IHDR chunk length");
                }
                const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
                width = view.getUint32(0, false);
                height = view.getUint32(4, false);
                bitDepth = view.getUint8(8);
                colorType = view.getUint8(9);

                if (!VALID_BIT_DEPTHS[colorType as PNGColorType]?.includes(bitDepth)) {
                    throw new Error(`Invalid bit depth ${bitDepth} for color type ${colorType}`);
                }
                break;
            }

            case "PLTE": {
                palette = chunk.data;
                break;
            }

            case "IDAT": {
                if (imageData === null) {
                    imageData = chunk.data;
                } else {
                    const combined: Uint8Array = new Uint8Array(imageData.length + chunk.data.length);
                    combined.set(imageData);
                    combined.set(chunk.data, imageData.length);
                    imageData = combined;
                }
                break;
            }

            case "IEND": {
                break;
            }
        }

        offset += chunk.totalLength;
    }

    if (imageData === null) {
        throw new Error("No image data found in PNG");
    }

    const decompressed = await decompressDeflate(imageData);

    let channels: number;
    switch (colorType) {
        case PNGColorType.GRAYSCALE:
            channels = 1;
            break;
        case PNGColorType.RGB:
            channels = 3;
            break;
        case PNGColorType.PALETTE:
            channels = 1;
            break;
        case PNGColorType.GRAYSCALE_ALPHA:
            channels = 2;
            break;
        case PNGColorType.RGBA:
            channels = 4;
            break;
        default:
            throw new Error(`Unsupported color type: ${colorType}`);
    }

    const unfiltered = removeFilters(decompressed, width, channels);

    let rgbaData: Uint8Array;
    switch (colorType) {
        case PNGColorType.GRAYSCALE:
            rgbaData = grayscaleToRGBA(unfiltered, bitDepth);
            break;
        case PNGColorType.RGB:
            rgbaData = rgbToRGBA(unfiltered, bitDepth);
            break;
        case PNGColorType.PALETTE:
            if (!palette) {
                throw new Error("PLTE chunk required for palette-based images");
            }
            rgbaData = paletteToRGBA(unfiltered, palette, bitDepth);
            break;
        case PNGColorType.GRAYSCALE_ALPHA:
            rgbaData = grayscaleAlphaToRGBA(unfiltered, bitDepth);
            break;
        case PNGColorType.RGBA:
            rgbaData = downsampleRGBA16ToRGBA8(unfiltered, bitDepth);
            break;
        default:
            throw new Error(`Unsupported color type: ${colorType}`);
    }

    if (!opts.preserveAlpha) {
        // Set all alpha values to 255 (opaque)
        for (let i = 3; i < rgbaData.length; i += 4) {
            rgbaData[i] = 255;
        }
    }

    if (opts.targetBitDepth !== 8) {
        const scale = 255 / ((1 << opts.targetBitDepth) - 1);
        for (let i = 0; i < rgbaData.length; i++) {
            rgbaData[i] = Math.round(rgbaData[i] * scale);
        }
    }

    return {
        width,
        height,
        pixels: rgbaData,
    };
}

/**
 * Detailed analysis of image content for format optimization
 */
export interface ImageAnalysis {
    /** Total number of pixels */
    totalPixels: number;
    /** Number of unique colors */
    uniqueColors: number;
    /** Whether the image is grayscale */
    isGrayscale: boolean;
    /** Whether the image has any alpha channel */
    hasAlpha: boolean;
    /** Whether the image has transparency (alpha = 0) */
    hasTransparency: boolean;
    /** Number of distinct alpha values */
    alphaValueCount: number;
    /** Whether alpha is binary (only 0 and 255) */
    isBinaryAlpha: boolean;
    /** Number of transparent pixels */
    transparentPixelCount: number;
    /** Percentage of transparent pixels */
    transparentPixelPercentage: number;
    /** Recommended PNG format */
    recommendedFormat: PNGEncodeOptions;
    /** Alternative formats with explanations */
    alternatives: Array<{
        format: PNGEncodeOptions;
        reason: string;
        estimatedSize: string;
    }>;
}

/**
 * Analyzes image content and provides detailed format recommendations
 * @param image - The decoded image to analyze
 * @param options - Analysis options
 * @returns Detailed analysis with format recommendations
 */
export function analyzeImageForPNG(
    image: DecodedImage,
    options: PNGAutoOptions = {},
): ImageAnalysis {
    const { width, height, pixels } = image;
    const totalPixels = width * height;

    let hasAlpha = false;
    let hasTransparency = false;
    const alphaValues = new Set<number>();
    let transparentPixels = 0;

    for (let i = 3; i < pixels.length; i += 4) {
        const alpha = pixels[i];
        alphaValues.add(alpha);
        if (alpha < 255) {
            hasAlpha = true;
            if (alpha === 0) {
                hasTransparency = true;
                transparentPixels++;
            }
        }
    }

    const colors = new Map<string, number>();
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        const key = `${r},${g},${b},${a}`;
        colors.set(key, (colors.get(key) || 0) + 1);
    }

    const uniqueColors = colors.size;
    const isGrayscale = analyzeGrayscale(pixels);
    const isBinaryAlpha = alphaValues.size <= 2 && hasAlpha;
    const transparentPixelPercentage = (transparentPixels / totalPixels) * 100;

    const recommendedFormat = detectOptimalPNGFormat(image, options);

    const alternatives: Array<{
        format: PNGEncodeOptions;
        reason: string;
        estimatedSize: string;
    }> = [];

    alternatives.push({
        format: { colorType: PNGColorType.RGBA, bitDepth: 8 },
        reason: "Full quality with alpha channel",
        estimatedSize: "Largest file size",
    });

    if (isGrayscale) {
        if (hasAlpha) {
            alternatives.push({
                format: { colorType: PNGColorType.GRAYSCALE_ALPHA, bitDepth: 8 },
                reason: "Grayscale with alpha channel",
                estimatedSize: "~50% smaller than RGBA",
            });
        } else {
            alternatives.push({
                format: { colorType: PNGColorType.GRAYSCALE, bitDepth: 8 },
                reason: "Grayscale without alpha",
                estimatedSize: "~75% smaller than RGBA",
            });
        }
    }

    if (!hasAlpha || isBinaryAlpha) {
        alternatives.push({
            format: { colorType: PNGColorType.RGB, bitDepth: 8 },
            reason: hasAlpha ? "RGB with binary transparency" : "RGB without alpha",
            estimatedSize: "~25% smaller than RGBA",
        });
    }

    if (uniqueColors <= 256 && options.preferSize) {
        alternatives.push({
            format: { colorType: PNGColorType.PALETTE, bitDepth: 8 },
            reason: `Limited color palette (${uniqueColors} colors)`,
            estimatedSize: "~60-80% smaller than RGBA",
        });
    }

    return {
        totalPixels,
        uniqueColors,
        isGrayscale,
        hasAlpha,
        hasTransparency,
        alphaValueCount: alphaValues.size,
        isBinaryAlpha,
        transparentPixelCount: transparentPixels,
        transparentPixelPercentage,
        recommendedFormat,
        alternatives,
    };
}

/**
 * Returns a human-readable, technical description of a PNG file's header and structure.
 * Includes color type detection, bit depth analysis, and chunk information.
 * @param data The full PNG file data as a Uint8Array.
 * @returns A string describing the PNG structure in plain language and technical detail.
 */
export function describePNGHeader(data: Uint8Array): string {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
        if (data[i] !== signature[i]) {
            throw new Error("Invalid PNG signature");
        }
    }

    const colorTypeMap: Record<number, string> = {
        [PNGColorType.GRAYSCALE]: "Grayscale",
        [PNGColorType.RGB]: "RGB",
        [PNGColorType.PALETTE]: "Palette",
        [PNGColorType.GRAYSCALE_ALPHA]: "Grayscale with Alpha",
        [PNGColorType.RGBA]: "RGBA",
    };

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let compression = 0;
    let filter = 0;
    let interlace = 0;
    let paletteSize = 0;
    const chunks: Array<{ type: string; length: number }> = [];

    while (offset < data.length) {
        const chunk = readChunk(data, offset);
        chunks.push({ type: chunk.type, length: chunk.length });

        switch (chunk.type) {
            case "IHDR": {
                if (chunk.length !== 13) {
                    throw new Error("Invalid IHDR chunk length");
                }
                const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
                width = view.getUint32(0, false);
                height = view.getUint32(4, false);
                bitDepth = view.getUint8(8);
                colorType = view.getUint8(9);
                compression = view.getUint8(10);
                filter = view.getUint8(11);
                interlace = view.getUint8(12);
                break;
            }

            case "PLTE": {
                paletteSize = chunk.length / 3;
                break;
            }

            case "IEND": {
                break;
            }
        }

        offset += chunk.totalLength;
    }

    const colorTypeDesc = colorTypeMap[colorType as PNGColorType] || `Unknown (${colorType})`;
    const compressionDesc = compression === 0 ? "Deflate" : `Unknown (${compression})`;
    const filterDesc = filter === 0 ? "Adaptive" : `Unknown (${filter})`;
    const interlaceDesc = interlace === 0 ? "None" : interlace === 1 ? "Adam7" : `Unknown (${interlace})`;

    const channels = (() => {
        switch (colorType) {
            case PNGColorType.GRAYSCALE:
                return 1;
            case PNGColorType.RGB:
                return 3;
            case PNGColorType.PALETTE:
                return 1;
            case PNGColorType.GRAYSCALE_ALPHA:
                return 2;
            case PNGColorType.RGBA:
                return 4;
            default:
                return "Unknown";
        }
    })();

    const lines = [
        `Signature: PNG (valid)`,
        `Width: ${width} px`,
        `Height: ${height} px`,
        `Bit depth: ${bitDepth} bits per channel`,
        `Color type: ${colorType} (${colorTypeDesc})`,
        `Channels: ${channels}`,
        `Compression: ${compression} (${compressionDesc})`,
        `Filter: ${filter} (${filterDesc})`,
        `Interlace: ${interlace} (${interlaceDesc})`,
    ];

    if (paletteSize > 0) {
        lines.push(`Palette: ${paletteSize} colors`);
    }

    lines.push(`Chunks found: ${chunks.map((c) => `${c.type}(${c.length})`).join(", ")}`);

    const fileSize = data.length;
    const imageSize = width * height;
    const bitsPerPixel = bitDepth * (channels as number);
    const uncompressedSize = (imageSize * bitsPerPixel) / 8;
    const compressionRatio = ((uncompressedSize - fileSize) / uncompressedSize * 100).toFixed(1);

    lines.push(`File size: ${fileSize} bytes`);
    lines.push(`Uncompressed size: ~${Math.round(uncompressedSize)} bytes`);
    lines.push(`Compression ratio: ~${compressionRatio}%`);

    return lines.join("\n");
}
