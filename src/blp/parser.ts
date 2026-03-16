import type { BLP1ContentType, BLP1Header, BLPColorEncoding, BLPHeader, BlpHeader, BLPMipmapData } from "../core/types.ts";

/**
 * Parses the header of a BLP file (BLP1 or BLP2) and returns the appropriate header object.
 * @param data - The full BLP file data as a Uint8Array.
 * @returns A BlpHeader (BLPHeader for BLP2, BLP1Header for BLP1).
 * @throws If the magic number is not 'BLP1' or 'BLP2'.
 */
export function parseBlpHeader(data: Uint8Array): BlpHeader {
    const magic = new TextDecoder().decode(data.slice(0x00, 0x04));
    if (magic === "BLP1") return parseBLP1Header(data);
    if (magic === "BLP2") return parseBLP2Header(data);
    throw new Error(`Invalid BLP magic number: '${magic}'. Expected 'BLP1' or 'BLP2'.`);
}

/**
 * Parses a BLP2 header (148 bytes).
 */
function parseBLP2Header(data: Uint8Array): BLPHeader {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const littleEndian = true;

    const version = view.getUint32(0x04, littleEndian);
    const compression = view.getUint8(0x08) as BLPColorEncoding;
    const alphaSize = view.getUint8(0x09);
    const preferredFormat = view.getUint8(0x0A);
    const hasMips = view.getUint8(0x0B);
    const width = view.getUint32(0x0C, littleEndian);
    const height = view.getUint32(0x10, littleEndian);

    const mipOffsets: number[] = [];
    for (let i = 0; i < 16; i++) {
        mipOffsets.push(view.getUint32(0x14 + i * 4, littleEndian));
    }
    const mipSizes: number[] = [];
    for (let i = 0; i < 16; i++) {
        mipSizes.push(view.getUint32(0x54 + i * 4, littleEndian));
    }

    return {
        magic: "BLP2",
        version,
        compression,
        alphaSize,
        preferredFormat,
        hasMips,
        width,
        height,
        mipOffsets,
        mipSizes,
    };
}

/**
 * Parses a BLP1 header (156 bytes / 0x9C).
 */
function parseBLP1Header(data: Uint8Array): BLP1Header {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const littleEndian = true;

    const content = view.getUint32(0x04, littleEndian) as BLP1ContentType;
    const alphaBitDepth = view.getUint32(0x08, littleEndian);
    const width = view.getUint32(0x0C, littleEndian);
    const height = view.getUint32(0x10, littleEndian);
    const extra = view.getUint32(0x14, littleEndian);
    const hasMipmaps = view.getUint32(0x18, littleEndian);

    const mipOffsets: number[] = [];
    for (let i = 0; i < 16; i++) {
        mipOffsets.push(view.getUint32(0x1C + i * 4, littleEndian));
    }
    const mipSizes: number[] = [];
    for (let i = 0; i < 16; i++) {
        mipSizes.push(view.getUint32(0x5C + i * 4, littleEndian));
    }

    return {
        magic: "BLP1",
        content,
        alphaBitDepth,
        width,
        height,
        extra,
        hasMipmaps,
        mipOffsets,
        mipSizes,
    };
}

/**
 * Extracts mipmap data from a BLP file using the parsed header.
 * Works for both BLP1 and BLP2 headers.
 * @param data - The full BLP file data as a Uint8Array.
 * @param header - A parsed BlpHeader (BLP1 or BLP2).
 * @returns An array of BLPMipmapData objects for each mipmap level found.
 * @throws If a mipmap offset/size is out of bounds.
 */
export function extractMipmaps(data: Uint8Array, header: BlpHeader): BLPMipmapData[] {
    const mipmaps: BLPMipmapData[] = [];
    let mipWidth = header.width;
    let mipHeight = header.height;
    for (let i = 0; i < 16; i++) {
        const offset = header.mipOffsets[i];
        const size = header.mipSizes[i];
        if (offset > 0 && size > 0) {
            if (offset + size > data.length) {
                throw new Error(`Mipmap #${i} exceeds file bounds.`);
            }
            mipmaps.push({
                width: mipWidth,
                height: mipHeight,
                offset,
                size,
                data: data.slice(offset, offset + size),
            });
        }
        mipWidth = Math.max(1, mipWidth >> 1);
        mipHeight = Math.max(1, mipHeight >> 1);
    }
    return mipmaps;
}
