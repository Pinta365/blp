import { assertEquals, assertThrows } from "@std/assert";
import { BLPColorEncoding } from "../core/types.ts";
import { extractMipmaps, parseBlpHeader } from "./parser.ts";

Deno.test("Parse BLP header - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    assertEquals(header.version, 1);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    assertEquals(header.width, 64);
    assertEquals(header.height, 64);
    assertEquals(header.alphaSize, 0);
    assertEquals(header.preferredFormat, 0);
    assertEquals(header.hasMips, 17);
    assertEquals(header.mipOffsets.length, 16);
    assertEquals(header.mipSizes.length, 16);
});

Deno.test("Parse BLP header - Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    assertEquals(header.version, 1);
    assertEquals(header.compression, BLPColorEncoding.PALETTE);
    assertEquals(header.width, 64);
    assertEquals(header.height, 64);
});

Deno.test("Parse BLP header - Uncompressed", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    assertEquals(header.version, 1);
    assertEquals(header.compression, BLPColorEncoding.ARGB8888);
    assertEquals(header.width, 512);
    assertEquals(header.height, 256);
});

Deno.test("Parse BLP header - Invalid magic", () => {
    const invalidData = new Uint8Array([0x42, 0x4C, 0x50, 0x31]); // "BLP1"
    assertThrows(() => parseBlpHeader(invalidData), Error, "Invalid BLP magic number");
});

Deno.test("Extract mipmaps - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const header = parseBlpHeader(data);
    const mipmaps = extractMipmaps(data, header);

    assertEquals(mipmaps.length > 0, true);
    assertEquals(mipmaps[0].width, 64);
    assertEquals(mipmaps[0].height, 64);
    assertEquals(mipmaps[0].data.length > 0, true);
});

Deno.test("Extract mipmaps - Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const header = parseBlpHeader(data);
    const mipmaps = extractMipmaps(data, header);

    assertEquals(mipmaps.length > 0, true);
    assertEquals(mipmaps[0].width, 64);
    assertEquals(mipmaps[0].height, 64);
    assertEquals(mipmaps[0].data.length > 0, true);
});

Deno.test("Extract mipmaps - Out of bounds error", () => {
    const header = {
        magic: "BLP2",
        version: 1,
        compression: BLPColorEncoding.DXT,
        alphaSize: 0,
        preferredFormat: 0,
        hasMips: 1,
        width: 64,
        height: 64,
        mipOffsets: [1000000], // Invalid offset
        mipSizes: [1000],
    };
    const data = new Uint8Array(1000);

    assertThrows(() => extractMipmaps(data, header), Error, "Mipmap #0 exceeds file bounds");
});
