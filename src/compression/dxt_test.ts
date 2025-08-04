import { assertEquals } from "@std/assert";
import { compressDXT1, compressDXT3, compressDXT5, decompressDXT1, decompressDXT3, decompressDXT5 } from "./dxt.ts";
import type { DecodedImage } from "../core/types.ts";
import { decodeBlpData } from "../blp/decoder.ts";

// Load a test image from BLP samples
async function loadDxt1TestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
    return decodeBlpData(data);
}

// Load a test image with transparency from BLP samples
async function loadDxt3TestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT3.blp");
    return decodeBlpData(data);
}

// Load a large test image from BLP samples
async function loadLargeDxt5TestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/1024x64_DXT5.blp");
    return decodeBlpData(data);
}

Deno.test("DXT1 compression and decompression", async () => {
    const original = await loadDxt1TestImage();
    const compressed = compressDXT1(original);
    const decompressed = decompressDXT1(compressed, original.width, original.height);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
    assertEquals(compressed.length, Math.ceil(original.width / 4) * Math.ceil(original.height / 4) * 8); // DXT1 block size
});

Deno.test("DXT3 compression and decompression", async () => {
    const original = await loadDxt3TestImage();
    const compressed = compressDXT3(original);
    const decompressed = decompressDXT3(compressed, original.width, original.height);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
    assertEquals(compressed.length, Math.ceil(original.width / 4) * Math.ceil(original.height / 4) * 16); // DXT3 block size
});

Deno.test("DXT5 compression and decompression", async () => {
    const original = await loadLargeDxt5TestImage();
    const compressed = compressDXT5(original);
    const decompressed = decompressDXT5(compressed, original.width, original.height);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
    assertEquals(compressed.length, Math.ceil(original.width / 4) * Math.ceil(original.height / 4) * 16); // DXT5 block size
});

Deno.test("DXT1 decompression - real data", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const header = { width: 64, height: 64 };
    const mipmapData = data.slice(0x94); // Skip header

    const decompressed = decompressDXT1(mipmapData, header.width, header.height);

    assertEquals(decompressed.width, 64);
    assertEquals(decompressed.height, 64);
    assertEquals(decompressed.pixels.length, 64 * 64 * 4);
});

Deno.test("DXT3 decompression - real data", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT3.blp");
    const header = { width: 64, height: 64 };
    const mipmapData = data.slice(0x94); // Skip header

    const decompressed = decompressDXT3(mipmapData, header.width, header.height);

    assertEquals(decompressed.width, 64);
    assertEquals(decompressed.height, 64);
    assertEquals(decompressed.pixels.length, 64 * 64 * 4);
});

Deno.test("DXT5 decompression - real data", async () => {
    const data = await Deno.readFile("./samples/blp/1024x64_DXT5.blp");
    const header = { width: 1024, height: 64 };
    const mipmapData = data.slice(0x94); // Skip header

    const decompressed = decompressDXT5(mipmapData, header.width, header.height);

    assertEquals(decompressed.width, 1024);
    assertEquals(decompressed.height, 64);
    assertEquals(decompressed.pixels.length, 1024 * 64 * 4);
});

Deno.test("DXT compression - large image", async () => {
    const original = await loadLargeDxt5TestImage();
    const compressed = compressDXT5(original);
    const decompressed = decompressDXT5(compressed, original.width, original.height);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
});

Deno.test("DXT compression - non-power-of-2 dimensions", () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const image = { width: 3, height: 3, pixels };

    // This should work with padding
    const compressed = compressDXT1(image);
    const decompressed = decompressDXT1(compressed, image.width, image.height);

    assertEquals(decompressed.width, 3);
    assertEquals(decompressed.height, 3);
    assertEquals(decompressed.pixels.length, 3 * 3 * 4);
});
