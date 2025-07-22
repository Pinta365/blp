import { decodeBlpData, encodeToPNG, PNGColorType } from "../mod.ts";

async function testMultipleFiles() {
    console.log("Testing PNG Export with Multiple BLP Files\n");

    const outputDir = "../samples/blp/output_batch";

    const sampleFiles = [
        "../samples/blp/512x256_BGRA.blp",
        "../samples/blp/256x256_DTX1.blp",
        "../samples/blp/64x64_DXT1.blp",
        "../samples/blp/64x64_DXT3.blp",
        "../samples/blp/512x64_palette.blp",
        "../samples/blp/64x64_palette.blp",
    ];

    const formats = [
        { name: "RGBA", colorType: PNGColorType.RGBA, bitDepth: 8 },
        { name: "RGB", colorType: PNGColorType.RGB, bitDepth: 8 },
        { name: "Grayscale", colorType: PNGColorType.GRAYSCALE, bitDepth: 8 },
        { name: "Palette8", colorType: PNGColorType.PALETTE, bitDepth: 8 },
        { name: "Palette4", colorType: PNGColorType.PALETTE, bitDepth: 4 },
    ];

    for (const sampleFile of sampleFiles) {
        try {
            console.log(`\n=== Testing ${sampleFile} ===`);

            const blpData = await Deno.readFile(sampleFile);
            const decodedImage = decodeBlpData(blpData);

            console.log(`  Image: ${decodedImage.width}x${decodedImage.height} pixels`);
            console.log(`  Data size: ${decodedImage.pixels.length} bytes`);

            // Test each format
            for (const format of formats) {
                try {
                    const startTime = performance.now();
                    const pngData = await encodeToPNG(decodedImage, {
                        colorType: format.colorType,
                        bitDepth: format.bitDepth,
                    });
                    const endTime = performance.now();

                    const baseName = sampleFile.split("/").pop()?.replace(".blp", "") || "unknown";
                    const filename = `${outputDir}/${baseName}_${format.name}.png`;
                    await Deno.writeFile(filename, pngData);

                    const compressionRatio = ((1 - pngData.length / decodedImage.pixels.length) * 100).toFixed(1);

                    console.log(
                        `  ✓ ${format.name}: ${(pngData.length / 1024).toFixed(1)} KB (${compressionRatio}% compression) in ${
                            (endTime - startTime).toFixed(1)
                        }ms`,
                    );

                    // Verify PNG structure for palette formats
                    if (format.colorType === PNGColorType.PALETTE) {
                        const pngString = new TextDecoder().decode(pngData);
                        if (pngString.includes("PLTE")) {
                            console.log(`    ✓ PLTE chunk found`);
                        } else {
                            console.log(`    ✗ PLTE chunk missing!`);
                        }
                    }
                } catch (error) {
                    console.error(`  ✗ ${format.name} failed: ${(error as Error).message}`);
                }
            }
        } catch (error) {
            console.error(`Failed to process ${sampleFile}: ${(error as Error).message}`);
        }
    }

    console.log("\n=== Test Summary ===");
    console.log("Check the generated PNG files to verify:");
    console.log("1. Palette images show proper colors (not black or outlines only)");
    console.log("2. Grayscale images show proper luminance conversion");
    console.log("3. RGB images show full color without transparency");
    console.log("4. RGBA images show full color with transparency");
}

if (import.meta.main) {
    testMultipleFiles();
}
