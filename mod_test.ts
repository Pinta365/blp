import { assertEquals } from "@std/assert";
import {
    BLPColorEncoding,
    decodeBlpData,
    decompressDXT1,
    decompressDXT3,
    decompressDXT5,
    decompressRAW1,
    decompressRAW3,
    encodeToPNG,
    extractMipmaps,
    parseBlpHeader,
    PNGColorType,
} from "./mod.ts";

// Helper to extract palette from a palettized BLP file
function extractPalette(data: Uint8Array): Uint8Array {
    // Palette is immediately after the header (0x94, 376 bytes)
    return data.slice(0x94, 0x94 + 1024);
}

Deno.test("Parse and decompress palettized BLP", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_palette.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.PALETTE);
    const palette = extractPalette(data);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressRAW1(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height, palette, header.alphaSize);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT1 BLP", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT1(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT3 BLP", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT3.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT3(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 64);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress DXT5 BLP", async () => {
    const data = await Deno.readFile("./samples/blp/1024x64_DXT5.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.DXT);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressDXT5(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 1024);
    assertEquals(decoded.height, 64);
});

Deno.test("Parse and decompress uncompressed BGRA BLP", async () => {
    const data = await Deno.readFile("./samples/blp/512x256_BGRA.blp");
    const header = parseBlpHeader(data);
    assertEquals(header.compression, BLPColorEncoding.ARGB8888);
    const mipmaps = extractMipmaps(data, header);
    const decoded = decompressRAW3(mipmaps[0].data, mipmaps[0].width, mipmaps[0].height);
    assertEquals(decoded.width, 512);
    assertEquals(decoded.height, 256);
});

// PNG Export Tests
Deno.test("Export BLP to PNG - RGBA 8-bit", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decodedImage = decodeBlpData(data);
    const pngData = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.RGBA,
        bitDepth: 8,
    });

    // Verify PNG signature
    assertEquals(pngData[0], 137); // PNG signature
    assertEquals(pngData[1], 80); // P
    assertEquals(pngData[2], 78); // N
    assertEquals(pngData[3], 71); // G

    // Verify file size is reasonable
    assertEquals(pngData.length > 1000, true);
});

Deno.test("Export BLP to PNG - Grayscale 8-bit", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decodedImage = decodeBlpData(data);
    const pngData = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.GRAYSCALE,
        bitDepth: 8,
    });

    // Verify PNG signature
    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);

    // Grayscale should be smaller than RGBA
    const rgbaData = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.RGBA,
        bitDepth: 8,
    });
    assertEquals(pngData.length < rgbaData.length, true);
});

Deno.test("Export BLP to PNG - Palette 4-bit", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decodedImage = decodeBlpData(data);
    const pngData = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.PALETTE,
        bitDepth: 4,
    });

    // Verify PNG signature
    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);

    // 4-bit palette should be smaller than 8-bit
    const palette8bit = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.PALETTE,
        bitDepth: 8,
    });
    assertEquals(pngData.length < palette8bit.length, true);
});

Deno.test("Export BLP to PNG - Custom Palette", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decodedImage = decodeBlpData(data);

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

    const pngData = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.PALETTE,
        bitDepth: 2,
        palette: customPalette,
    });

    // Verify PNG signature
    assertEquals(pngData[0], 137);
    assertEquals(pngData[1], 80);
    assertEquals(pngData[2], 78);
    assertEquals(pngData[3], 71);

    // Should be very small with 2-bit palette
    assertEquals(pngData.length < 1000, true);
});

Deno.test("Export BLP to PNG - Error handling", async () => {
    const data = await Deno.readFile("./samples/blp/64x64_DXT1.blp");
    const decodedImage = decodeBlpData(data);

    // Test invalid bit depth for RGB
    try {
        await encodeToPNG(decodedImage, {
            colorType: PNGColorType.RGB,
            bitDepth: 4, // Invalid: RGB only supports 8 or 16 bit
        });
        assertEquals(false, true); // Should not reach here
    } catch (error) {
        assertEquals((error as Error).message.includes("Invalid bit depth 4 for color type 2"), true);
    }

    // Test custom palette too large
    try {
        const largePalette = new Uint8Array(Array(15).fill(255)); // 5 colors for 2-bit (max 4)
        await encodeToPNG(decodedImage, {
            colorType: PNGColorType.PALETTE,
            bitDepth: 2,
            palette: largePalette,
        });
        assertEquals(false, true); // Should not reach here
    } catch (error) {
        assertEquals((error as Error).message.includes("Custom palette has 5 colors"), true);
    }
});
