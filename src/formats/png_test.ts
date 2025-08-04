import { assertEquals, assertRejects } from "@std/assert";
import { analyzeImageForPNG, decodePNGData, encodeToPNG, encodeToPNGAuto, PNGColorType } from "./png.ts";
import { decodeBlpData } from "../blp/decoder.ts";
import type { DecodedImage } from "../core/types.ts";

// Load a test image from BLP samples
async function loadBlpTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
    return decodeBlpData(data);
}

// Load a test image from PNG samples
async function loadPngTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/png/trade_alchemy.png");
    return await decodePNGData(data);
}

// Load a larger test image from BLP samples
async function loadLargeBlpTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/512x256_BGRA.blp");
    return decodeBlpData(data);
}

// Load a palette-based BLP image
async function loadPaletteBlpImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_palette.blp");
    return decodeBlpData(data);
}

Deno.test("PNG encoding - RGBA 8-bit", async () => {
    const image = await loadBlpTestImage();
    const pngData = await encodeToPNG(image, {
        colorType: PNGColorType.RGBA,
        bitDepth: 8,
    });

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG encoding - Grayscale 8-bit", async () => {
    const image = await loadBlpTestImage();
    const pngData = await encodeToPNG(image, {
        colorType: PNGColorType.GRAYSCALE,
        bitDepth: 8,
    });

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG encoding - RGB 8-bit", async () => {
    const image = await loadBlpTestImage();
    const pngData = await encodeToPNG(image, {
        colorType: PNGColorType.RGB,
        bitDepth: 8,
    });

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG encoding - Palette 8-bit", async () => {
    const image = await loadPaletteBlpImage();
    const pngData = await encodeToPNG(image, {
        colorType: PNGColorType.PALETTE,
        bitDepth: 8,
    });

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG encoding - Custom palette", async () => {
    const image = await loadPaletteBlpImage();
    const customPalette = new Uint8Array([
        255,
        0,
        0, // Red
        0,
        255,
        0, // Green
        0,
        0,
        255, // Blue
        255,
        255,
        255, // White
    ]);

    const pngData = await encodeToPNG(image, {
        colorType: PNGColorType.PALETTE,
        bitDepth: 2,
        palette: customPalette,
    });

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG encoding - Error handling", async () => {
    const image = await loadBlpTestImage();

    await assertRejects(
        async () => {
            await encodeToPNG(image, {
                colorType: PNGColorType.RGB,
                bitDepth: 4,
            });
        },
        Error,
        "Invalid bit depth 4 for color type 2",
    );

    await assertRejects(
        async () => {
            const largePalette = new Uint8Array(Array(15).fill(255));
            await encodeToPNG(image, {
                colorType: PNGColorType.PALETTE,
                bitDepth: 2,
                palette: largePalette,
            });
        },
        Error,
        "Custom palette has 5 colors, but bit depth 2 only supports 4 colors",
    );
});

Deno.test("PNG auto encoding", async () => {
    const image = await loadBlpTestImage();
    const pngData = await encodeToPNGAuto(image);

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);
});

Deno.test("PNG analysis", async () => {
    const image = await loadBlpTestImage();
    const analysis = analyzeImageForPNG(image);

    assertEquals(analysis.totalPixels, image.width * image.height);
    assertEquals(analysis.uniqueColors > 0, true);
    assertEquals(analysis.recommendedFormat.colorType, PNGColorType.RGB);
    assertEquals(analysis.alternatives.length > 0, true);
});

Deno.test("PNG analysis - large image", async () => {
    const image = await loadLargeBlpTestImage();
    const analysis = analyzeImageForPNG(image);

    assertEquals(analysis.totalPixels, image.width * image.height);
    assertEquals(analysis.uniqueColors > 0, true);
    assertEquals(analysis.recommendedFormat.colorType, PNGColorType.RGBA);
    assertEquals(analysis.alternatives.length > 0, true);
});

Deno.test("PNG analysis - palette image", async () => {
    const image = await loadPaletteBlpImage();
    const analysis = analyzeImageForPNG(image);

    assertEquals(analysis.totalPixels, image.width * image.height);
    assertEquals(analysis.uniqueColors > 0, true);
    assertEquals(analysis.recommendedFormat.colorType, PNGColorType.RGB);
    assertEquals(analysis.alternatives.length > 0, true);
});

Deno.test("PNG analysis - palette image with size preference", async () => {
    const image = await loadPaletteBlpImage();
    const analysis = analyzeImageForPNG(image, { preferSize: true });

    assertEquals(analysis.totalPixels, image.width * image.height);
    assertEquals(analysis.uniqueColors > 0, true);
    assertEquals(analysis.recommendedFormat.colorType, PNGColorType.PALETTE);
    assertEquals(analysis.alternatives.length > 0, true);
});

Deno.test("PNG round-trip", async () => {
    const original = await loadBlpTestImage();
    const pngData = await encodeToPNG(original);
    const decoded = await decodePNGData(pngData);

    assertEquals(decoded.width, original.width);
    assertEquals(decoded.height, original.height);
    assertEquals(decoded.pixels.length, original.pixels.length);
});

Deno.test("PNG round-trip - large image", async () => {
    const original = await loadLargeBlpTestImage();
    const pngData = await encodeToPNG(original);
    const decoded = await decodePNGData(pngData);

    assertEquals(decoded.width, original.width);
    assertEquals(decoded.height, original.height);
    assertEquals(decoded.pixels.length, original.pixels.length);
});

Deno.test("PNG decode options", async () => {
    const image = await loadBlpTestImage();

    const originalAlphaValues = new Set<number>();
    for (let i = 3; i < image.pixels.length; i += 4) {
        originalAlphaValues.add(image.pixels[i]);
    }

    const pngData = await encodeToPNG(image);

    const withAlpha = await decodePNGData(pngData, { preserveAlpha: true });
    assertEquals(withAlpha.pixels.length, image.pixels.length);

    const withoutAlpha = await decodePNGData(pngData, { preserveAlpha: false });
    assertEquals(withoutAlpha.pixels.length, image.pixels.length);

    let hasDifferentAlpha = false;
    for (let i = 3; i < withAlpha.pixels.length; i += 4) {
        if (withAlpha.pixels[i] !== withoutAlpha.pixels[i]) {
            hasDifferentAlpha = true;
            break;
        }
    }

    if (originalAlphaValues.size === 1 && originalAlphaValues.has(255)) {
        assertEquals(hasDifferentAlpha, false);
    } else {
        assertEquals(hasDifferentAlpha, true);
    }
});

Deno.test("PNG encoding from existing PNG", async () => {
    const original = await loadPngTestImage();
    const pngData = await encodeToPNG(original);

    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);
    assertEquals(pngData.length > 100, true);

    const decoded = await decodePNGData(pngData);
    assertEquals(decoded.width, original.width);
    assertEquals(decoded.height, original.height);
    assertEquals(decoded.pixels.length, original.pixels.length);
});
