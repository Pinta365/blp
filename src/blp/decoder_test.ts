import { assertEquals, assertThrows } from "@std/assert";
import { decodeBlpData, describeBLPHeader } from "./decoder.ts";

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
    const invalidData = new Uint8Array([0x42, 0x4C, 0x50, 0x32]);
    assertThrows(() => decodeBlpData(invalidData), Error);
});

Deno.test("Describe header - DXT1", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const description = describeBLPHeader(data);

    assertEquals(description.includes("Magic: BLP2"), true);
    assertEquals(description.includes("Version: 1"), true);
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
