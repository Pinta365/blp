import type { BLPColorEncoding, BLPHeader, BLPMipmapData } from "./blp_types.ts";

/**
 * Parses the header of a BLP2 file and returns a BLPHeader object.
 * @param data - The full BLP file data as a Uint8Array.
 * @returns The parsed BLPHeader object.
 * @throws If the magic number is not 'BLP2' or the file is invalid.
 */
export function parseBlpHeader(data: Uint8Array): BLPHeader {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const littleEndian = true;

    const magic = new TextDecoder().decode(data.slice(0x00, 0x04));
    if (magic !== "BLP2") {
        throw new Error("Invalid BLP magic number. Expected 'BLP2'.");
    }

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
        magic,
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
 * Extracts mipmap data from a BLP file using the parsed header.
 * @param data - The full BLP file data as a Uint8Array.
 * @param header - The parsed BLPHeader object.
 * @returns An array of BLPMipmapData objects for each mipmap level found.
 * @throws If a mipmap offset/size is out of bounds.
 */
export function extractMipmaps(data: Uint8Array, header: BLPHeader): BLPMipmapData[] {
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
