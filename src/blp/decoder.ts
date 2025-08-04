import { extractMipmaps, parseBlpHeader } from "./parser.ts";
import { decompressDXT1, decompressDXT3, decompressDXT5 } from "../compression/dxt.ts";
import { decompressRAW1, decompressRAW3 } from "../compression/palette.ts";
import type { DecodedImage } from "../core/types.ts";

/**
 * Decodes a BLP file from a Uint8Array and returns the main image as RGBA pixel data.
 * Automatically detects the format and dispatches to the correct decompressor.
 * @param data The full BLP file data as a Uint8Array.
 * @returns The decoded main image as a DecodedImage (RGBA pixel data).
 * @throws If the file is invalid or unsupported.
 */
export function decodeBlpData(data: Uint8Array): DecodedImage {
    const header = parseBlpHeader(data);
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
 * Returns a human-readable, technical description of a BLP file's header.
 * Includes DXT type detection and more technical details.
 * @param data The full BLP file data as a Uint8Array.
 * @returns A string describing the header fields in plain language and technical detail.
 */
export function describeBLPHeader(data: Uint8Array): string {
    const header = parseBlpHeader(data);
    const compressionMap: Record<number, string> = {
        1: "Palettized (RAW1)",
        2: "DXT-compressed (DXT1/3/5)",
        3: "Uncompressed (RAW3, A8R8G8B8)",
    };
    const compressionDesc = compressionMap[header.compression] || `Unknown (${header.compression})`;

    const alphaDesc = header.alphaSize === 0
        ? "No alpha channel"
        : header.alphaSize === 1
        ? "1-bit alpha (binary mask)"
        : header.alphaSize === 4
        ? "4-bit alpha (rare)"
        : header.alphaSize === 8
        ? "8-bit alpha (full)"
        : `Unknown (${header.alphaSize})`;

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
        `Magic: ${header.magic} (should be 'BLP2')`,
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
