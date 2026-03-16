import { assertEquals, assertThrows } from "@std/assert";
import { decodeBlpData, describeBLPHeader } from "./decoder.ts";
import { buildBLP1PaletteBuffer } from "../test_helpers.ts";

Deno.test("Decode BLP data - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
    assertEquals(decoded.pixels.length, 64 * 64 * 4);
    assertEquals(decoded.pixels.length > 0, true);
});

Deno.test("Decode BLP data - DXT3", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT3.blp");
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
    assertEquals(decoded.pixels.length, 64 * 64 * 4);
    assertEquals(decoded.pixels.length > 0, true);
});

Deno.test("Decode BLP data - DXT5", async () => {
    const data = await Deno.readFile("./samples/blp/1024x64_DXT5.blp");
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 1024);
    assertEquals(decoded.height, 64);
    assertEquals(decoded.pixels.length, 1024 * 64 * 4);
    assertEquals(decoded.pixels.length > 0, true);
});

Deno.test("Decode BLP data - Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
    assertEquals(decoded.pixels.length, 64 * 64 * 4);
    assertEquals(decoded.pixels.length > 0, true);
});

Deno.test("Decode BLP data - Uncompressed", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 512);
    assertEquals(decoded.height, 256);
    assertEquals(decoded.pixels.length, 512 * 256 * 4);
    assertEquals(decoded.pixels.length > 0, true);
});

Deno.test("Decode BLP data - Invalid file", () => {
    const invalidData = new Uint8Array([0x42, 0x4C, 0x50, 0x30]); // "BLP0"
    assertThrows(() => decodeBlpData(invalidData), Error);
});

// --- BLP1 decode tests ---

Deno.test("Decode BLP1 data - palette, no alpha", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 0 });
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 4);
    assertEquals(decoded.height, 4);
    assertEquals(decoded.pixels.length, 4 * 4 * 4);

    // Pixel 0 uses palette index 0 (B=0 G=0 R=0), alpha should be 255 (no alpha → opaque)
    assertEquals(decoded.pixels[0], 0); // R
    assertEquals(decoded.pixels[1], 0); // G
    assertEquals(decoded.pixels[2], 0); // B
    assertEquals(decoded.pixels[3], 255); // A
});

Deno.test("Decode BLP1 data - palette, 8-bit alpha", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 8 });
    const decoded = decodeBlpData(data);

    assertEquals(decoded.width, 4);
    assertEquals(decoded.height, 4);
    assertEquals(decoded.pixels.length, 4 * 4 * 4);

    // Alpha bytes are all 0xFF in the test buffer
    assertEquals(decoded.pixels[3], 255);
    assertEquals(decoded.pixels[7], 255);
});

Deno.test("Decode BLP1 data - palette colour correctness", () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 0 });
    const decoded = decodeBlpData(data);

    // Pixel 1 uses palette index 1: B=1, G=0, R=0 → RGBA = (0, 0, 1, 255)
    assertEquals(decoded.pixels[4], 0); // R = palIdx >> 2 = 0
    assertEquals(decoded.pixels[5], 0); // G = palIdx >> 1 = 0
    assertEquals(decoded.pixels[6], 1); // B = palIdx & 0xFF = 1
    assertEquals(decoded.pixels[7], 255); // A

    // Pixel 2 uses palette index 2: B=2, G=1, R=0 → RGBA = (0, 1, 2, 255)
    assertEquals(decoded.pixels[8], 0); // R
    assertEquals(decoded.pixels[9], 1); // G
    assertEquals(decoded.pixels[10], 2); // B
    assertEquals(decoded.pixels[11], 255);
});

Deno.test("Decode BLP1 data - JPEG with invalid data throws", () => {
    const buf = new Uint8Array(256);
    const view = new DataView(buf.buffer);
    buf[0] = 0x42;
    buf[1] = 0x4C;
    buf[2] = 0x50;
    buf[3] = 0x31; // "BLP1"
    view.setUint32(0x04, 0, true); // content = JPEG
    view.setUint32(0x08, 0, true); // alphaBitDepth
    view.setUint32(0x0C, 4, true); // width
    view.setUint32(0x10, 4, true); // height
    view.setUint32(0x14, 5, true); // extra
    view.setUint32(0x18, 0, true); // hasMipmaps
    view.setUint32(0x1C, 0x9C + 4, true); // mipOffset[0]
    view.setUint32(0x5C, 16, true); // mipSize[0]

    assertThrows(() => decodeBlpData(buf), Error);
});

// --- Describe header tests ---

Deno.test("Describe header - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const description = describeBLPHeader(data);

    assertEquals(description.includes("Magic: BLP2"), true);
    assertEquals(description.includes("Compression: 2"), true);
    assertEquals(description.includes("Width: 64 px"), true);
    assertEquals(description.includes("Height: 64 px"), true);
    assertEquals(description.includes("DXT type: DXT1"), true);
});

Deno.test("Describe header - Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const description = describeBLPHeader(data);

    assertEquals(description.includes("Magic: BLP2"), true);
    assertEquals(description.includes("Compression: 1"), true);
    assertEquals(description.includes("Palettized (RAW1)"), true);
});

Deno.test("Describe header - Uncompressed", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const description = describeBLPHeader(data);

    assertEquals(description.includes("Magic: BLP2"), true);
    assertEquals(description.includes("Compression: 3"), true);
    assertEquals(description.includes("Uncompressed (RAW3, A8R8G8B8)"), true);
});

Deno.test("Describe header - BLP1 palette", async () => {
    const data = buildBLP1PaletteBuffer({ width: 4, height: 4, alphaBitDepth: 8 });
    const description = describeBLPHeader(data);

    assertEquals(description.includes("Magic: BLP1"), true);
    assertEquals(description.includes("Palettized"), true);
    assertEquals(description.includes("8-bit alpha (full)"), true);
    assertEquals(description.includes("Width: 4 px"), true);
    assertEquals(description.includes("Height: 4 px"), true);
});
