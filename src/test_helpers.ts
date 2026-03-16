/**
 * Builds a minimal valid BLP1 palette file buffer in memory for testing.
 * Generates a single-mipmap image with a simple gradient palette.
 */
export function buildBLP1PaletteBuffer(opts: {
    width: number;
    height: number;
    alphaBitDepth: number;
}): Uint8Array {
    const { width, height, alphaBitDepth } = opts;
    const numPixels = width * height;

    const paletteSize = 256 * 4; // BGRX
    const indexSize = numPixels;
    let alphaSize = 0;
    if (alphaBitDepth === 8) alphaSize = numPixels;
    else if (alphaBitDepth === 4) alphaSize = Math.ceil(numPixels / 2);
    else if (alphaBitDepth === 1) alphaSize = Math.ceil(numPixels / 8);
    const mipDataSize = indexSize + alphaSize;

    const headerSize = 0x9C; // 156 bytes
    const mipDataOffset = headerSize + paletteSize;
    const totalSize = mipDataOffset + mipDataSize;

    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    const le = true;

    // Magic
    buf[0] = 0x42;
    buf[1] = 0x4C;
    buf[2] = 0x50;
    buf[3] = 0x31; // "BLP1"
    // Content = 1 (palette)
    view.setUint32(0x04, 1, le);
    // AlphaBitDepth
    view.setUint32(0x08, alphaBitDepth, le);
    // Width, Height
    view.setUint32(0x0C, width, le);
    view.setUint32(0x10, height, le);
    // Extra (typically 5)
    view.setUint32(0x14, 5, le);
    // HasMipmaps = 0 (single mip)
    view.setUint32(0x18, 0, le);

    // Mip offsets[0]
    view.setUint32(0x1C, mipDataOffset, le);
    // Mip sizes[0]
    view.setUint32(0x5C, mipDataSize, le);

    // Palette at 0x9C: simple gradient (entry i = BGRX with B=i, G=i/2, R=i/4)
    for (let i = 0; i < 256; i++) {
        const off = headerSize + i * 4;
        buf[off + 0] = i & 0xFF; // B
        buf[off + 1] = (i >> 1) & 0xFF; // G
        buf[off + 2] = (i >> 2) & 0xFF; // R
        buf[off + 3] = 0; // padding
    }

    // Pixel indices: use index = (y * width + x) % 256
    for (let i = 0; i < numPixels; i++) {
        buf[mipDataOffset + i] = i % 256;
    }

    // Alpha: fill with 0xFF (fully opaque)
    if (alphaSize > 0) {
        buf.fill(0xFF, mipDataOffset + indexSize, mipDataOffset + indexSize + alphaSize);
    }

    return buf;
}
