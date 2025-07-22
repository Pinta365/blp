import type { DecodedImage } from "../core/types.ts";
import { uint8ArrayToStream } from "../utils/streams.ts";

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
 * Encodes a DecodedImage to PNG format (RGBA, 8-bit per channel).
 * Simplified version used for development
 * @param image - The DecodedImage to encode.
 * @returns A Promise resolving to a Uint8Array containing the PNG file data.
 */
export async function encodeToPNG(image: DecodedImage): Promise<Uint8Array> {
    const { width, height, pixels } = image;
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    ihdr[0] = (width >>> 24) & 0xff;
    ihdr[1] = (width >>> 16) & 0xff;
    ihdr[2] = (width >>> 8) & 0xff;
    ihdr[3] = width & 0xff;
    ihdr[4] = (height >>> 24) & 0xff;
    ihdr[5] = (height >>> 16) & 0xff;
    ihdr[6] = (height >>> 8) & 0xff;
    ihdr[7] = height & 0xff;
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    const ihdrChunk = writeChunk("IHDR", ihdr);
    const scanlineLen = width * 4 + 1;
    const raw = new Uint8Array(scanlineLen * height);
    for (let y = 0; y < height; y++) {
        raw[y * scanlineLen] = 0;
        raw.set(
            pixels.subarray(y * width * 4, (y + 1) * width * 4),
            y * scanlineLen + 1,
        );
    }
    const cs = new CompressionStream("deflate");
    const compressed = await new Response(
        uint8ArrayToStream(raw).pipeThrough(cs),
    ).arrayBuffer();
    const idatChunk = writeChunk("IDAT", new Uint8Array(compressed));
    const iendChunk = writeChunk("IEND", new Uint8Array(0));
    const totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const png = new Uint8Array(totalLen);
    let offset = 0;
    png.set(signature, offset);
    offset += signature.length;
    png.set(ihdrChunk, offset);
    offset += ihdrChunk.length;
    png.set(idatChunk, offset);
    offset += idatChunk.length;
    png.set(iendChunk, offset);
    return png;
} 