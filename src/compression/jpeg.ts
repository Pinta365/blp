import type { DecodedImage } from "../core/types.ts";
import { decodeJPEG } from "./jpeg_decoder.ts";

const BLP1_HEADER_SIZE = 0x9C;
const MAX_JPEG_HEADER_SIZE = 624;

/**
 * Decodes a BLP1 JPEG mipmap into RGBA pixel data.
 *
 * BLP1 JPEG stores raw BGRA components (not Y'CbCr). We decode with
 * `colorTransform: false` to prevent Y'CbCr→RGB conversion, then
 * swizzle B↔R to produce standard RGBA output.
 *
 * @param fileData  Full BLP1 file bytes.
 * @param mipData   Raw mipmap body bytes (from extractMipmaps).
 * @param width     Expected mipmap width.
 * @param height    Expected mipmap height.
 * @param alphaBitDepth  0 or 8; when 0, alpha is forced to 0xFF.
 */
export function decompressBLP1JPEG(
    fileData: Uint8Array,
    mipData: Uint8Array,
    width: number,
    height: number,
    alphaBitDepth: number,
): DecodedImage {
    const view = new DataView(fileData.buffer, fileData.byteOffset, fileData.byteLength);
    const jpegHeaderSize = view.getUint32(BLP1_HEADER_SIZE, true);

    if (jpegHeaderSize > MAX_JPEG_HEADER_SIZE) {
        console.warn(
            `BLP1 JPEG header size ${jpegHeaderSize} exceeds recommended maximum of ${MAX_JPEG_HEADER_SIZE}.`,
        );
    }

    const jpegHeader = fileData.subarray(BLP1_HEADER_SIZE + 4, BLP1_HEADER_SIZE + 4 + jpegHeaderSize);

    const blob = new Uint8Array(jpegHeader.length + mipData.length);
    blob.set(jpegHeader, 0);
    blob.set(mipData, jpegHeader.length);

    const decoded = decodeJPEG(blob, {
        colorTransform: false,
        tolerantDecoding: true,
    });

    const pixels = new Uint8Array(width * height * 4);
    const srcW = decoded.width;
    const srcH = decoded.height;
    const srcData = decoded.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstIdx = (y * width + x) * 4;
            if (x < srcW && y < srcH) {
                const srcIdx = (y * srcW + x) * 4;
                pixels[dstIdx + 0] = srcData[srcIdx + 2]; // R
                pixels[dstIdx + 1] = srcData[srcIdx + 1]; // G
                pixels[dstIdx + 2] = srcData[srcIdx + 0]; // B
                pixels[dstIdx + 3] = alphaBitDepth === 0 ? 255 : srcData[srcIdx + 3]; // A
            }
        }
    }

    return { width, height, pixels };
}
