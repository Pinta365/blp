import { assertEquals } from "@std/assert";
import { compressRAW1, compressRAW3, decompressRAW1, decompressRAW3, generatePalette } from "./palette.ts";
import type { DecodedImage } from "../core/types.ts";
import { decodeBlpData } from "../blp/decoder.ts";

// Load a test image from BLP samples
async function loadPaletteTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_palette.blp");
    return decodeBlpData(data);
}

// Load a test image with limited colors from BLP samples
async function loadLimitedColorTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/raw1_1bit.blp");
    return decodeBlpData(data);
}

// Create a test image with limited colors - keeping for specific tests
function createLimitedColorImage(): DecodedImage {
    const pixels = new Uint8Array(4 * 4 * 4);
    const colors = [
        [255, 0, 0, 255], // Red
        [0, 255, 0, 255], // Green
        [0, 0, 255, 255], // Blue
        [255, 255, 255, 255], // White
    ];

    for (let i = 0; i < pixels.length; i += 4) {
        const color = colors[i / 4 % colors.length];
        pixels[i] = color[0]; // R
        pixels[i + 1] = color[1]; // G
        pixels[i + 2] = color[2]; // B
        pixels[i + 3] = color[3]; // A
    }
    return { width: 4, height: 4, pixels };
}

Deno.test("RAW1 compression and decompression", async () => {
    const original = await loadLimitedColorTestImage();
    const compressed = compressRAW1(original, 8);
    const palette = new Uint8Array(1024); // Mock palette
    const decompressed = decompressRAW1(compressed, original.width, original.height, palette, 8);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
});

Deno.test("RAW3 compression and decompression", async () => {
    const original = await loadPaletteTestImage();
    const compressed = compressRAW3(original);
    const decompressed = decompressRAW3(compressed, original.width, original.height);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
    assertEquals(compressed.length, original.pixels.length);
});

Deno.test("Generate palette - limited colors", async () => {
    const image = await loadLimitedColorTestImage();
    const { palette, indices } = generatePalette(image.pixels, 256);

    assertEquals(palette.length > 0, true);
    assertEquals(indices.length, image.width * image.height);
    assertEquals(indices.length > 0, true);
});

Deno.test("Generate palette - many colors", () => {
    const pixels = new Uint8Array(100 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = i % 256; // R
        pixels[i + 1] = (i + 1) % 256; // G
        pixels[i + 2] = (i + 2) % 256; // B
        pixels[i + 3] = 255; // A
    }

    const { palette, indices } = generatePalette(pixels, 256);

    assertEquals(palette.length > 0, true);
    assertEquals(indices.length, 100);
    assertEquals(indices.length > 0, true);
});

Deno.test("Generate palette - max colors limit", () => {
    const pixels = new Uint8Array(100 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = i % 256; // R
        pixels[i + 1] = (i + 1) % 256; // G
        pixels[i + 2] = (i + 2) % 256; // B
        pixels[i + 3] = 255; // A
    }

    const { palette, indices } = generatePalette(pixels, 16);

    assertEquals(palette.length <= 16 * 3, true);
    assertEquals(indices.length, 100);
});

Deno.test("RAW1 decompression - real data", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const header = { width: 64, height: 64 };
    const mipmapData = data.slice(0x94); // Skip header
    const palette = data.slice(0x94, 0x94 + 1024); // Extract palette

    const decompressed = decompressRAW1(mipmapData, header.width, header.height, palette, 8);

    assertEquals(decompressed.width, 64);
    assertEquals(decompressed.height, 64);
    assertEquals(decompressed.pixels.length, 64 * 64 * 4);
});

Deno.test("RAW3 decompression - real data", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const header = { width: 512, height: 256 };
    const mipmapData = data.slice(0x94); // Skip header

    const decompressed = decompressRAW3(mipmapData, header.width, header.height);

    assertEquals(decompressed.width, 512);
    assertEquals(decompressed.height, 256);
    assertEquals(decompressed.pixels.length, 512 * 256 * 4);
});

Deno.test("RAW1 compression - different alpha sizes", async () => {
    const original = await loadLimitedColorTestImage();

    // Test with different alpha sizes
    const compressed1 = compressRAW1(original, 1);
    const compressed4 = compressRAW1(original, 4);
    const compressed8 = compressRAW1(original, 8);

    assertEquals(compressed1.length > 0, true);
    assertEquals(compressed4.length > 0, true);
    assertEquals(compressed8.length > 0, true);
});

Deno.test("Palette compression - synthetic limited colors", () => {
    const original = createLimitedColorImage();
    const compressed = compressRAW1(original, 8);
    const palette = new Uint8Array(1024); // Mock palette
    const decompressed = decompressRAW1(compressed, original.width, original.height, palette, 8);

    assertEquals(decompressed.width, original.width);
    assertEquals(decompressed.height, original.height);
    assertEquals(decompressed.pixels.length, original.pixels.length);
});
