import { assertEquals, assertThrows } from "@std/assert";
import {
    autoResizeToPowerOf2,
    calculateOptimalDimensions,
    centerPadToPowerOf2,
    closestPowerOf2,
    nextPowerOf2,
    padToPowerOf2,
    prevPowerOf2,
    resizeImage,
    ResizeMode,
} from "./resize.ts";
import type { DecodedImage } from "../core/types.ts";
import { decodeBlpData } from "../blp/decoder.ts";

// Load a test image from BLP samples
async function loadTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
    return decodeBlpData(data);
}

// Load a large test image from BLP samples
async function loadLargeTestImage(): Promise<DecodedImage> {
    const data = await Deno.readFile("samples/blp/512x256_BGRA.blp");
    return decodeBlpData(data);
}

// Create a simple test image - keeping for specific tests
function createTestImage(): DecodedImage {
    const pixels = new Uint8Array(3 * 3 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 255; // R
        pixels[i + 1] = 128; // G
        pixels[i + 2] = 64; // B
        pixels[i + 3] = 255; // A
    }
    return { width: 3, height: 3, pixels };
}

Deno.test("Power of 2 utilities", () => {
    assertEquals(nextPowerOf2(3), 4);
    assertEquals(nextPowerOf2(4), 4);
    assertEquals(nextPowerOf2(5), 8);
    assertEquals(nextPowerOf2(7), 8);
    assertEquals(nextPowerOf2(8), 8);

    assertEquals(prevPowerOf2(3), 2);
    assertEquals(prevPowerOf2(4), 4);
    assertEquals(prevPowerOf2(5), 4);
    assertEquals(prevPowerOf2(7), 4);
    assertEquals(prevPowerOf2(8), 8);

    assertEquals(closestPowerOf2(3), 2);
    assertEquals(closestPowerOf2(4), 4);
    assertEquals(closestPowerOf2(5), 4);
    assertEquals(closestPowerOf2(6), 4);
    assertEquals(closestPowerOf2(7), 8);
    assertEquals(closestPowerOf2(8), 8);
});

Deno.test("Calculate optimal dimensions", () => {
    const small = calculateOptimalDimensions(3, 3, false);
    assertEquals(small.width, 2);
    assertEquals(small.height, 2);

    const large = calculateOptimalDimensions(3, 3, true);
    assertEquals(large.width, 4);
    assertEquals(large.height, 4);

    const exact = calculateOptimalDimensions(4, 4, false);
    assertEquals(exact.width, 4);
    assertEquals(exact.height, 4);
});

Deno.test("Auto resize to power of 2", async () => {
    const image = await loadTestImage();
    const resized = autoResizeToPowerOf2(image);

    assertEquals(resized.width, 64);
    assertEquals(resized.height, 64);
    assertEquals(resized.pixels.length, 64 * 64 * 4);
});

Deno.test("Auto resize to power of 2 - already power of 2", async () => {
    const image = await loadTestImage();
    const resized = autoResizeToPowerOf2(image);

    assertEquals(resized.width, 64);
    assertEquals(resized.height, 64);
    assertEquals(resized.pixels.length, 64 * 64 * 4);
});

Deno.test("Resize image - force mode", async () => {
    const image = await loadTestImage();
    const resized = resizeImage(image, {
        width: 128,
        height: 128,
        mode: ResizeMode.FORCE,
    });

    assertEquals(resized.width, 128);
    assertEquals(resized.height, 128);
    assertEquals(resized.pixels.length, 128 * 128 * 4);
});

Deno.test("Resize image - pad mode", async () => {
    const image = await loadTestImage();
    const resized = resizeImage(image, {
        width: 128,
        height: 128,
        mode: ResizeMode.PAD,
    });

    assertEquals(resized.width, 128);
    assertEquals(resized.height, 128);
    assertEquals(resized.pixels.length, 128 * 128 * 4);
});

Deno.test("Resize image - pad center mode", async () => {
    const image = await loadTestImage();
    const resized = resizeImage(image, {
        width: 128,
        height: 128,
        mode: ResizeMode.PAD_CENTER,
    });

    assertEquals(resized.width, 128);
    assertEquals(resized.height, 128);
    assertEquals(resized.pixels.length, 128 * 128 * 4);
});

Deno.test("Resize image - custom fill color", async () => {
    const image = await loadTestImage();
    const resized = resizeImage(image, {
        width: 128,
        height: 128,
        mode: ResizeMode.PAD,
        fillColor: { r: 255, g: 0, b: 0, a: 255 },
    });

    assertEquals(resized.width, 128);
    assertEquals(resized.height, 128);
    assertEquals(resized.pixels.length, 128 * 128 * 4);
});

Deno.test("Pad to power of 2", async () => {
    const image = await loadTestImage();
    const padded = padToPowerOf2(image);

    assertEquals(padded.width, 64);
    assertEquals(padded.height, 64);
    assertEquals(padded.pixels.length, 64 * 64 * 4);
});

Deno.test("Center pad to power of 2", async () => {
    const image = await loadTestImage();
    const padded = centerPadToPowerOf2(image);

    assertEquals(padded.width, 64);
    assertEquals(padded.height, 64);
    assertEquals(padded.pixels.length, 64 * 64 * 4);
});

Deno.test("Resize image - invalid dimensions", () => {
    const image = createTestImage();

    assertThrows(
        () => {
            resizeImage(image, {
                width: 6,
                height: 6,
                mode: ResizeMode.FORCE,
            });
        },
        Error,
        "Target dimensions must be powers of 2",
    );
});

Deno.test("Resize image - maintain aspect ratio", async () => {
    const image = await loadLargeTestImage(); // 512x256
    const resized = resizeImage(image, {
        width: 256,
        height: 128,
        mode: ResizeMode.FORCE,
    });

    assertEquals(resized.width, 256);
    assertEquals(resized.height, 128);
    assertEquals(resized.pixels.length, 256 * 128 * 4);
});

Deno.test("Auto resize with different modes", () => {
    const image = createTestImage();

    const resized1 = autoResizeToPowerOf2(image);
    assertEquals(resized1.width, 2);
    assertEquals(resized1.height, 2);

    const resized2 = autoResizeToPowerOf2(image, ResizeMode.PAD_CENTER, true);
    assertEquals(resized2.width, 4);
    assertEquals(resized2.height, 4);
});

Deno.test("Auto resize with custom fill color", () => {
    const image = createTestImage();

    const resized = autoResizeToPowerOf2(image, ResizeMode.PAD_CENTER, false, { r: 0, g: 255, b: 0, a: 255 });

    assertEquals(resized.width, 2);
    assertEquals(resized.height, 2);
    assertEquals(resized.pixels.length, 2 * 2 * 4);
});
