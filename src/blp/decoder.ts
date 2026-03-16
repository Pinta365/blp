import { extractMipmaps, parseBlpHeader } from "./parser.ts";
import { decompressDXT1, decompressDXT3, decompressDXT5 } from "../compression/dxt.ts";
import { decompressRAW1, decompressRAW3 } from "../compression/palette.ts";
import { decompressBLP1JPEG } from "../compression/jpeg.ts";
import type { BLP1Header, DecodedImage } from "../core/types.ts";
import { BLP1ContentType, isBLP1Header } from "../core/types.ts";

/**
 * Decodes a BLP file from a Uint8Array and returns the main image as RGBA pixel data.
 * Automatically detects BLP1/BLP2 and dispatches to the correct decompressor.
 * @param data The full BLP file data as a Uint8Array.
 * @returns The decoded main image as a DecodedImage (RGBA pixel data).
 * @throws If the file is invalid or unsupported.
 */
export function decodeBlpData(data: Uint8Array): DecodedImage {
    const header = parseBlpHeader(data);

    if (isBLP1Header(header)) {
        return decodeBLP1Data(data, header);
    }

    const mipmaps = extractMipmaps(data, header);
    if (mipmaps.length === 0) throw new Error("No mipmaps found in BLP file.");
    const main = mipmaps[0];
    if (header.compression === 1) {
        const palette = data.subarray(0x94, 0x94 + 1024);
        return decompressRAW1(main.data, main.width, main.height, palette, header.alphaSize);
    } else if (header.compression === 2) {
        if (header.preferredFormat === 1) {
            return decompressDXT3(main.data, main.width, main.height);
        } else if (header.preferredFormat === 7) {
            return decompressDXT5(main.data, main.width, main.height);
        } else {
            return decompressDXT1(main.data, main.width, main.height);
        }
    } else if (header.compression === 3) {
        return decompressRAW3(main.data, main.width, main.height);
    } else {
        throw new Error(`Unsupported BLP compression type: ${header.compression}`);
    }
}

/**
 * Decodes a BLP1 file's main image.
 * Supports palette mode (content=1) and JPEG mode (content=0).
 */
function decodeBLP1Data(data: Uint8Array, header: BLP1Header): DecodedImage {
    const mipmaps = extractMipmaps(data, header);
    if (mipmaps.length === 0) throw new Error("No mipmaps found in BLP1 file.");
    const main = mipmaps[0];

    if (header.content === BLP1ContentType.PALETTE) {
        const palette = data.subarray(0x9C, 0x9C + 1024);
        return decompressRAW1(main.data, main.width, main.height, palette, header.alphaBitDepth);
    }

    if (header.content === BLP1ContentType.JPEG) {
        return decompressBLP1JPEG(data, main.data, main.width, main.height, header.alphaBitDepth);
    }

    throw new Error(`Unknown BLP1 content type: ${header.content}`);
}

/**
 * Returns a human-readable, technical description of a BLP file's header.
 * Supports both BLP1 and BLP2 files.
 * @param data The full BLP file data as a Uint8Array.
 * @returns A string describing the header fields in plain language and technical detail.
 */
export function describeBLPHeader(data: Uint8Array): string {
    const header = parseBlpHeader(data);

    if (isBLP1Header(header)) {
        return describeBLP1Header(header);
    }

    const compressionMap: Record<number, string> = {
        1: "Palettized (RAW1)",
        2: "DXT-compressed (DXT1/3/5)",
        3: "Uncompressed (RAW3, A8R8G8B8)",
    };
    const compressionDesc = compressionMap[header.compression] || `Unknown (${header.compression})`;

    const alphaDesc = describeAlpha(header.alphaSize);

    const mipDesc = header.hasMips === 0
        ? "Only main image (no mipmaps)"
        : header.hasMips === 1 || header.hasMips === 2
        ? "Multiple mipmaps present"
        : `Unknown (${header.hasMips})`;

    const preferredFormatDesc = header.preferredFormat === 0
        ? "Default/unspecified"
        : header.preferredFormat === 1
        ? "DXT3 (if DXT)"
        : header.preferredFormat === 7
        ? "DXT5 (if DXT)"
        : `${header.preferredFormat}`;

    let dxtType = "";
    let dxtExplain = "";
    if (header.compression === 2) {
        if (header.preferredFormat === 1) {
            dxtType = "DXT3";
            dxtExplain = "(preferredFormat=1, alphaSize=8)";
        } else if (header.preferredFormat === 7) {
            dxtType = "DXT5";
            dxtExplain = "(preferredFormat=7, alphaSize=8)";
        } else {
            dxtType = "DXT1";
            dxtExplain = "(preferredFormat=0 or 2, alphaSize=0 or 1)";
        }
    }

    const lines = [
        `Magic: ${header.magic} (BLP2)`,
        `Version: ${header.version} (should be 1)`,
        `Compression: ${header.compression} (${compressionDesc})`,
        `Alpha size: ${header.alphaSize} (${alphaDesc})`,
        `Preferred format: ${header.preferredFormat} (${preferredFormatDesc})`,
        `Mipmaps: ${mipDesc}`,
        `Width: ${header.width} px`,
        `Height: ${header.height} px`,
        `Mipmap offsets: [${header.mipOffsets.join(", ")}]`,
        `Mipmap sizes: [${header.mipSizes.join(", ")}]`,
    ];
    if (dxtType) {
        lines.push(`DXT type: ${dxtType} ${dxtExplain}`);
        lines.push(`  (DXT type is determined by preferredFormat and alphaSize fields)`);
    }
    return lines.join("\n");
}

function describeBLP1Header(header: BLP1Header): string {
    const contentDesc = header.content === BLP1ContentType.JPEG
        ? "JPEG"
        : header.content === BLP1ContentType.PALETTE
        ? "Palettized"
        : `Unknown (${header.content})`;

    const alphaDesc = describeAlpha(header.alphaBitDepth);

    const mipDesc = header.hasMipmaps === 0 ? "Only main image (no mipmaps)" : "Mipmaps present";

    return [
        `Magic: BLP1`,
        `Content: ${header.content} (${contentDesc})`,
        `Alpha bit depth: ${header.alphaBitDepth} (${alphaDesc})`,
        `Width: ${header.width} px`,
        `Height: ${header.height} px`,
        `Extra: ${header.extra}`,
        `Mipmaps: ${mipDesc}`,
        `Mipmap offsets: [${header.mipOffsets.join(", ")}]`,
        `Mipmap sizes: [${header.mipSizes.join(", ")}]`,
    ].join("\n");
}

function describeAlpha(bits: number): string {
    switch (bits) {
        case 0:
            return "No alpha channel";
        case 1:
            return "1-bit alpha (binary mask)";
        case 4:
            return "4-bit alpha (rare)";
        case 8:
            return "8-bit alpha (full)";
        default:
            return `Unknown (${bits})`;
    }
}
