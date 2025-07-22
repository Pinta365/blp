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
 * Converts RGBA pixels to grayscale with proper bit depth support
 */
function rgbaToGrayscale(pixels: Uint8Array, bitDepth: number): Uint8Array {
    const maxValue = (1 << bitDepth) - 1;
    const scale = maxValue / 255;

    if (bitDepth <= 8) {
        const result = new Uint8Array(pixels.length / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            // Use luminance formula: 0.299*R + 0.587*G + 0.114*B
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
 * Converts RGBA pixels to RGB with proper bit depth support
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
        // 16-bit RGB
        const result = new Uint16Array(pixels.length * 3 / 4);

        for (let i = 0; i < pixels.length; i += 4) {
            result[i * 3 / 4] = pixels[i] * 257; // R (scale 0-255 to 0-65535)
            result[i * 3 / 4 + 1] = pixels[i + 1] * 257; // G
            result[i * 3 / 4 + 2] = pixels[i + 2] * 257; // B
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Converts RGBA pixels to grayscale with alpha with proper bit depth support
 */
function rgbaToGrayscaleAlpha(pixels: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        const result = new Uint8Array(pixels.length / 2);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 2] = gray; // Gray
            result[i / 2 + 1] = pixels[i + 3]; // Alpha
        }

        return result;
    } else {
        // 16-bit grayscale with alpha
        const result = new Uint16Array(pixels.length / 2);

        for (let i = 0; i < pixels.length; i += 4) {
            const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            result[i / 2] = gray * 257; // Gray (scale 0-255 to 0-65535)
            result[i / 2 + 1] = pixels[i + 3] * 257; // Alpha
        }

        return new Uint8Array(result.buffer);
    }
}

/**
 * Converts RGBA pixels to RGBA with proper bit depth support
 */
function rgbaToRgba(pixels: Uint8Array, bitDepth: number): Uint8Array {
    if (bitDepth === 8) {
        return pixels;
    } else {
        // 16-bit RGBA
        const result = new Uint16Array(pixels.length);

        for (let i = 0; i < pixels.length; i++) {
            result[i] = pixels[i] * 257; // Scale 0-255 to 0-65535
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
        // Use provided custom palette
        const paletteColors = customPalette.length / 3;
        if (paletteColors > maxColors) {
            throw new Error(`Custom palette has ${paletteColors} colors, but bit depth ${bitDepth} only supports ${maxColors} colors`);
        }

        const indices: number[] = [];

        // Find closest color in custom palette for each pixel
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

    // Generate palette from image
    const colorMap = new Map<string, number>();
    const rgbPalette: number[] = [];
    const indices: number[] = [];

    // First pass: collect unique RGB colors (ignore alpha for palette)
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

    // If we have too many colors, do color reduction
    if (rgbPalette.length / 3 > maxColors) {
        // Simple approach: take evenly distributed colors
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

        // Remap indices to new palette
        const newIndices: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Find closest color in reduced palette
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
    const filtered = new Uint8Array(data.length + height); // +1 for filter type per row

    for (let y = 0; y < height; y++) {
        const rowStart = y * width * channels;
        const filteredRowStart = y * (width * channels + 1);

        // Use filter type 0 (None) for simplicity
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
    ihdr[12] = 0; // interlace (not implemented)

    const ihdrChunk = writeChunk("IHDR", ihdr);

    // Convert pixels based on color type
    let imageData: Uint8Array;
    let channels: number;
    let plteChunk: Uint8Array | undefined;

    switch (opts.colorType) {
        case PNGColorType.GRAYSCALE:
            imageData = rgbaToGrayscale(pixels, opts.bitDepth);
            channels = 1;
            // Pack pixels for low bit depths
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
            // Pack pixels for low bit depths
            if (opts.bitDepth < 8) {
                imageData = packPixels(imageData, opts.bitDepth);
            }
            // Add PLTE chunk - palette is already in RGB format
            plteChunk = writeChunk("PLTE", paletteData.palette);
            break;
        }

        case PNGColorType.GRAYSCALE_ALPHA:
            imageData = rgbaToGrayscaleAlpha(pixels, opts.bitDepth);
            channels = 2;
            break;

        case PNGColorType.RGBA:
        default:
            imageData = rgbaToRgba(pixels, opts.bitDepth);
            channels = 4;
            break;
    }

    // Apply filters
    const filteredData = applyFilters(imageData, width, channels);

    // Compress data with specified compression level
    const cs = new CompressionStream("deflate");
    const compressed = await new Response(
        uint8ArrayToStream(filteredData).pipeThrough(cs),
    ).arrayBuffer();

    const idatChunk = writeChunk("IDAT", new Uint8Array(compressed));
    const iendChunk = writeChunk("IEND", new Uint8Array(0));

    // Calculate total length
    let totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    if (opts.colorType === PNGColorType.PALETTE) {
        totalLen += plteChunk!.length;
    }

    // Assemble PNG
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
