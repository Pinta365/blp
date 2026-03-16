import { assertEquals, assertThrows } from "@std/assert";
import { BLP1ContentType, BLPColorEncoding } from "../core/types.ts";
import { isBLP1Header } from "../core/types.ts";
import { extractMipmaps, parseBlpHeader } from "./parser.ts";
import { buildBLP1PaletteBuffer } from "../test_helpers.ts";

Deno.test("Parse BLP header - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    assertEquals(isBLP1Header(header), false);
    if (!isBLP1Header(header)) {
        assertEquals(header.version, 1);
        assertEquals(header.compression, BLPColorEncoding.DXT);
        assertEquals(header.alphaSize, 0);
        assertEquals(header.preferredFormat, 0);
        assertEquals(header.hasMips, 17);
    }
    assertEquals(header.width, 64);
    assertEquals(header.height, 64);
    assertEquals(header.mipOffsets.length, 16);
    assertEquals(header.mipSizes.length, 16);
});

Deno.test("Parse BLP header - Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    if (!isBLP1Header(header)) {
        assertEquals(header.version, 1);
        assertEquals(header.compression, BLPColorEncoding.PALETTE);
    }
    assertEquals(header.width, 64);
    assertEquals(header.height, 64);
});

Deno.test("Parse BLP header - Uncompressed", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP2");
    if (!isBLP1Header(header)) {
        assertEquals(header.version, 1);
        assertEquals(header.compression, BLPColorEncoding.ARGB8888);
    }
    assertEquals(header.width, 512);
    assertEquals(header.height, 256);
});

Deno.test("Parse BLP header - Invalid magic", () => {
    const invalidData = new Uint8Array([0x42, 0x4C, 0x50, 0x30]); // "BLP0"
    assertThrows(() => parseBlpHeader(invalidData), Error, "Invalid BLP magic number");
});

Deno.test("Parse BLP1 header - palette, no alpha", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 0 });
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP1");
    assertEquals(isBLP1Header(header), true);
    if (isBLP1Header(header)) {
        assertEquals(header.content, BLP1ContentType.PALETTE);
        assertEquals(header.alphaBitDepth, 0);
        assertEquals(header.extra, 5);
        assertEquals(header.hasMipmaps, 0);
    }
    assertEquals(header.width, 4);
    assertEquals(header.height, 4);
    assertEquals(header.mipOffsets.length, 16);
    assertEquals(header.mipSizes.length, 16);
});

Deno.test("Parse BLP1 header - palette, 8-bit alpha", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 8 });
    const header = parseBlpHeader(data);

    assertEquals(header.magic, "BLP1");
    if (isBLP1Header(header)) {
        assertEquals(header.content, BLP1ContentType.PALETTE);
        assertEquals(header.alphaBitDepth, 8);
    }
    assertEquals(header.width, 4);
    assertEquals(header.height, 4);
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

Deno.test("Extract mipmaps - BLP1 palette", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 0 });
    const header = parseBlpHeader(data);
    const mipmaps = extractMipmaps(data, header);

    assertEquals(mipmaps.length, 1);
    assertEquals(mipmaps[0].width, 4);
    assertEquals(mipmaps[0].height, 4);
    assertEquals(mipmaps[0].data.length, 4 * 4); // indices only, no alpha
});

Deno.test("Extract mipmaps - Out of bounds error", () => {
    const header = {
        magic: "BLP2" as const,
        version: 1,
        compression: BLPColorEncoding.DXT,
        alphaSize: 0,
        preferredFormat: 0,
        hasMips: 1,
        width: 64,
        height: 64,
        mipOffsets: [1000000],
        mipSizes: [1000],
    };
    const data = new Uint8Array(1000);

    assertThrows(() => extractMipmaps(data, header), Error, "Mipmap #0 exceeds file bounds");
});
