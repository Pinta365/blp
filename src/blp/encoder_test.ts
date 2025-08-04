import { assertEquals, assertThrows } from "@std/assert";
import { encodeToBLP, encodeToDXT1BLP, encodeToDXT3BLP, encodeToDXT5BLP, encodeToPaletteBLP, encodeToUncompressedBLP } from "./encoder.ts";
import { BLPColorEncoding, BLPPixelFormat } from "../core/types.ts";
import type { DecodedImage } from "../core/types.ts";
import { decodeBlpData } from "./decoder.ts";
import { ResizeMode } from "../utils/resize.ts";

// Load a test image from BLP samples
async function loadBlpTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
    return decodeBlpData(data);
}

// Load a test image with transparency from BLP samples
async function loadTransparentBlpImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT3.blp");
    return decodeBlpData(data);
}

// Load a palette-based BLP image
async function loadPaletteBlpImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_palette.blp");
    return decodeBlpData(data);
}

// Load a larger test image from BLP samples
async function loadLargeBlpImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/512x256_BGRA.blp");
    return decodeBlpData(data);
}

Deno.test("Encode to BLP - DXT1", async () => {
    const image = await loadBlpTestImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        alphaSize: 0,
        preferredFormat: BLPPixelFormat.DXT1,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42); // 'B'
    assertEquals(blpData[1], 0x4C); // 'L'
    assertEquals(blpData[2], 0x50); // 'P'
    assertEquals(blpData[3], 0x32); // '2'
});

Deno.test("Encode to BLP - DXT5", async () => {
    const image = await loadTransparentBlpImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        alphaSize: 8,
        preferredFormat: BLPPixelFormat.DXT5,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - Palette", async () => {
    const image = await loadPaletteBlpImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.PALETTE,
        alphaSize: 8,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - Uncompressed", async () => {
    const image = await loadBlpTestImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.ARGB8888,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - with mipmaps", async () => {
    const image = await loadBlpTestImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        generateMipmaps: true,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - non-power-of-2 with auto-resize", () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const image = { width: 3, height: 3, pixels };

    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        autoResize: true,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - non-power-of-2 without auto-resize", () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const image = { width: 3, height: 3, pixels };

    assertThrows(
        () => {
            encodeToBLP(image, {
                compression: BLPColorEncoding.DXT,
                autoResize: false,
            });
        },
        Error,
        "Image dimensions must be powers of 2",
    );
});

Deno.test("Convenience encoders - DXT1", async () => {
    const image = await loadBlpTestImage();
    const blpData = encodeToDXT1BLP(image);

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Convenience encoders - DXT3", async () => {
    const image = await loadTransparentBlpImage();
    const blpData = encodeToDXT3BLP(image);

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Convenience encoders - DXT5", async () => {
    const image = await loadTransparentBlpImage();
    const blpData = encodeToDXT5BLP(image);

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Convenience encoders - Palette", async () => {
    const image = await loadPaletteBlpImage();
    const blpData = encodeToPaletteBLP(image, 8);

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Convenience encoders - Uncompressed", async () => {
    const image = await loadBlpTestImage();
    const blpData = encodeToUncompressedBLP(image);

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - custom fill color", () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const image = { width: 3, height: 3, pixels };

    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        autoResize: true,
        fillColor: { r: 255, g: 0, b: 0, a: 255 },
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - different resize modes", () => {
    const pixels = new Uint8Array(3 * 3 * 4);
    const image = { width: 3, height: 3, pixels };

    const blpData1 = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        autoResize: true,
        resizeMode: ResizeMode.PAD,
    });

    const blpData2 = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        autoResize: true,
        resizeMode: ResizeMode.PAD_CENTER,
    });

    assertEquals(blpData1.length > 0, true);
    assertEquals(blpData2.length > 0, true);
    assertEquals(blpData1[0], 0x42);
    assertEquals(blpData2[0], 0x42);
});

Deno.test("Encode to BLP - large image", async () => {
    const image = await loadLargeBlpImage();
    const blpData = encodeToBLP(image, {
        compression: BLPColorEncoding.DXT,
        preferredFormat: BLPPixelFormat.DXT5,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);
});

Deno.test("Encode to BLP - round-trip test", async () => {
    const original = await loadBlpTestImage();
    const blpData = encodeToBLP(original, {
        compression: BLPColorEncoding.DXT,
        preferredFormat: BLPPixelFormat.DXT1,
    });

    assertEquals(blpData.length > 0, true);
    assertEquals(blpData[0], 0x42);
    assertEquals(blpData[1], 0x4C);
    assertEquals(blpData[2], 0x50);
    assertEquals(blpData[3], 0x32);

    // Verify we can decode it back
    const decoded = decodeBlpData(blpData);
    assertEquals(decoded.width, original.width);
    assertEquals(decoded.height, original.height);
    assertEquals(decoded.pixels.length, original.pixels.length);
});
