import { assertEquals } from "@std/assert";
import { extractMipmaps, parseBlpHeader } from "./src/blp_parser.ts";
import { decompressRAW1, decompressRAW3 } from "./src/palettized_decompressor.ts";
import { decompressDXT1, decompressDXT3, decompressDXT5 } from "./src/dxt_decompressor.ts";
import { BLPColorEncoding } from "./src/blp_types.ts";

// Helper to extract palette from a palettized BLP file
function extractPalette(data: Uint8Array): Uint8Array {
    // Palette is immediately after the header (0x94, 376 bytes)
    return data.slice(0x94, 0x94 + 1024);
}

Deno.test("Parse and decompress palettized BLP", async () => {
    const data = await Deno.readFile("./samples/64x64_palette.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.PALETTE);
    const palette = extractPalette(data);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressRAW1(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height, palette, header.alphaSize);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT1 BLP", async () => {
    const data = await Deno.readFile("./samples/64x64_DXT1.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT1(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT3 BLP", async () => {
    const data = await Deno.readFile("./samples/64x64_DXT3.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT3(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT5 BLP", async () => {
    const data = await Deno.readFile("./samples/1024x64_DXT5.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT5(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 1024);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress uncompressed BGRA BLP", async () => {
    const data = await Deno.readFile("./samples/512x256_BGRA.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.ARGB8888);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressRAW3(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 512);
    assertEquals(decoded.height, 256);
});
