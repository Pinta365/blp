import { decodeBlpData, encodeToPNG, PNGColorType } from "../mod.ts";

interface FormatTest {
    name: string;
    description: string;
    options: {
        colorType: PNGColorType;
        bitDepth: number;
        palette?: Uint8Array;
    };
}

interface TestResult {
    name: string;
    description: string;
    fileSize: number;
    encodeTime: number;
    compressionRatio: number;
}

/**
 * Custom palettes for testing
 */
const CUSTOM_PALETTES = {
    // 4-color palette (2-bit)
    fourColors: new Uint8Array([
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
    ]),

    // 16-color palette (4-bit)
    sixteenColors: new Uint8Array([
        0,
        0,
        0, // Black
        85,
        85,
        85, // Dark Gray
        170,
        170,
        170, // Light Gray
        255,
        255,
        255, // White
        255,
        0,
        0, // Red
        255,
        85,
        0, // Orange
        255,
        255,
        0, // Yellow
        85,
        255,
        0, // Lime
        0,
        255,
        0, // Green
        0,
        255,
        85, // Spring Green
        0,
        255,
        255, // Cyan
        0,
        85,
        255, // Blue
        85,
        0,
        255, // Purple
        255,
        0,
        255, // Magenta
        255,
        0,
        85, // Rose
        128,
        128,
        128, // Gray
    ]),
};

/**
 * All supported format tests
 */
const FORMAT_TESTS: FormatTest[] = [
    // RGBA formats
    {
        name: "rgba_8bit",
        description: "RGBA 8-bit (default)",
        options: { colorType: PNGColorType.RGBA, bitDepth: 8 },
    },
    {
        name: "rgba_16bit",
        description: "RGBA 16-bit (high quality)",
        options: { colorType: PNGColorType.RGBA, bitDepth: 16 },
    },

    // RGB formats
    {
        name: "rgb_8bit",
        description: "RGB 8-bit (no alpha)",
        options: { colorType: PNGColorType.RGB, bitDepth: 8 },
    },
    {
        name: "rgb_16bit",
        description: "RGB 16-bit (high quality, no alpha)",
        options: { colorType: PNGColorType.RGB, bitDepth: 16 },
    },

    // Grayscale formats
    {
        name: "grayscale_1bit",
        description: "Grayscale 1-bit (binary)",
        options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 1 },
    },
    {
        name: "grayscale_2bit",
        description: "Grayscale 2-bit (4 levels)",
        options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 2 },
    },
    {
        name: "grayscale_4bit",
        description: "Grayscale 4-bit (16 levels)",
        options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 4 },
    },
    {
        name: "grayscale_8bit",
        description: "Grayscale 8-bit (256 levels)",
        options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 8 },
    },
    {
        name: "grayscale_16bit",
        description: "Grayscale 16-bit (65536 levels)",
        options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 16 },
    },

    // Grayscale with alpha
    {
        name: "grayscale_alpha_8bit",
        description: "Grayscale + Alpha 8-bit",
        options: { colorType: PNGColorType.GRAYSCALE_ALPHA, bitDepth: 8 },
    },
    {
        name: "grayscale_alpha_16bit",
        description: "Grayscale + Alpha 16-bit",
        options: { colorType: PNGColorType.GRAYSCALE_ALPHA, bitDepth: 16 },
    },

    // Palette formats
    {
        name: "palette_1bit",
        description: "Palette 1-bit (2 colors)",
        options: { colorType: PNGColorType.PALETTE, bitDepth: 1 },
    },
    {
        name: "palette_2bit",
        description: "Palette 2-bit (4 colors)",
        options: { colorType: PNGColorType.PALETTE, bitDepth: 2 },
    },
    {
        name: "palette_4bit",
        description: "Palette 4-bit (16 colors)",
        options: { colorType: PNGColorType.PALETTE, bitDepth: 4 },
    },
    {
        name: "palette_8bit",
        description: "Palette 8-bit (256 colors)",
        options: { colorType: PNGColorType.PALETTE, bitDepth: 8 },
    },

    // Custom palette formats
    {
        name: "custom_palette_2bit",
        description: "Custom 4-color palette (2-bit)",
        options: {
            colorType: PNGColorType.PALETTE,
            bitDepth: 2,
            palette: CUSTOM_PALETTES.fourColors,
        },
    },
    {
        name: "custom_palette_4bit",
        description: "Custom 16-color palette (4-bit)",
        options: {
            colorType: PNGColorType.PALETTE,
            bitDepth: 4,
            palette: CUSTOM_PALETTES.sixteenColors,
        },
    },
];

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format time in milliseconds
 */
function formatTime(ms: number): string {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Test a single format
 */
async function testFormat(
    image: any,
    test: FormatTest,
    baselineSize: number,
): Promise<TestResult> {
    const startTime = performance.now();

    try {
        const pngData = await encodeToPNG(image, test.options);
        const endTime = performance.now();
        const encodeTime = endTime - startTime;
        const fileSize = pngData.length;
        const compressionRatio = ((baselineSize - fileSize) / baselineSize) * 100;

        return {
            name: test.name,
            description: test.description,
            fileSize,
            encodeTime,
            compressionRatio,
        };
    } catch (error) {
        console.error(`Error testing ${test.name}:`, (error as Error).message);
        return {
            name: test.name,
            description: test.description,
            fileSize: 0,
            encodeTime: 0,
            compressionRatio: 0,
        };
    }
}

/**
 * Main demo function
 */
async function runPNGExportDemo() {
    console.log("🎨 PNG Export Demo - Testing All Supported Formats\n");

    // Create output directory
    try {
        await Deno.mkdir("png_output", { recursive: true });
    } catch {
        // Directory already exists
    }

    // Get sample BLP files
    const sampleFiles = [
        "samples/blp/512x256_BGRA.blp",
        "samples/blp/256x256_DTX1.blp",
        "samples/blp/64x64_DXT1.blp",
        "samples/blp/facialupperhair05_01_hd.blp",
    ];

    const results: TestResult[] = [];

    for (const blpFile of sampleFiles) {
        try {
            console.log(`📁 Processing: ${blpFile}`);

            // Read and decode BLP file
            const blpData = await Deno.readFile(blpFile);
            const decodedImage = decodeBlpData(blpData);

            console.log(`   Image: ${decodedImage.width}x${decodedImage.height} pixels`);

            // Get baseline size (RGBA 8-bit)
            const baselineData = await encodeToPNG(decodedImage, {
                colorType: PNGColorType.RGBA,
                bitDepth: 8,
            });
            const baselineSize = baselineData.length;

            console.log(`   Baseline size: ${formatBytes(baselineSize)}`);
            console.log(`   Testing ${FORMAT_TESTS.length} formats...\n`);

            // Test all formats
            for (const test of FORMAT_TESTS) {
                const result = await testFormat(decodedImage, test, baselineSize);
                results.push(result);

                // Save the PNG file
                if (result.fileSize > 0) {
                    const pngData = await encodeToPNG(decodedImage, test.options);
                    const filename = `${blpFile.split("/").pop()?.replace(".blp", "")}_${test.name}.png`;
                    await Deno.writeFile(`png_output/${filename}`, pngData);
                }

                // Progress indicator
                Deno.stdout.writeSync(new TextEncoder().encode("."));
            }
            console.log("\n");
        } catch (error) {
            console.error(`❌ Error processing ${blpFile}:`, (error as Error).message);
        }
    }

    // Generate summary report
    await generateSummaryReport(results);

    console.log("✅ Demo complete! Check the 'png_output/' directory for generated PNG files.");
    console.log("📊 See 'png_output/summary_report.txt' for detailed performance metrics.");
}

/**
 * Generate summary report
 */
async function generateSummaryReport(results: TestResult[]) {
    const report = [
        "PNG Export Performance Report",
        "=============================",
        "",
        `Generated: ${new Date().toISOString()}`,
        `Total formats tested: ${results.length}`,
        "",
        "Format Comparison:",
        "==================",
        "",
    ];

    // Sort by file size (ascending)
    const sortedResults = [...results].sort((a, b) => a.fileSize - b.fileSize);

    // Table header
    report.push(
        "Format".padEnd(25) +
            "Description".padEnd(35) +
            "Size".padEnd(10) +
            "Time".padEnd(8) +
            "Compression".padEnd(12),
    );
    report.push("-".repeat(90));

    // Table rows
    for (const result of sortedResults) {
        if (result.fileSize > 0) {
            report.push(
                result.name.padEnd(25) +
                    result.description.padEnd(35) +
                    formatBytes(result.fileSize).padEnd(10) +
                    formatTime(result.encodeTime).padEnd(8) +
                    `${result.compressionRatio.toFixed(1)}%`.padEnd(12),
            );
        }
    }

    // Performance analysis
    report.push("");
    report.push("Performance Analysis:");
    report.push("====================");

    const validResults = results.filter((r) => r.fileSize > 0);
    if (validResults.length > 0) {
        const avgSize = validResults.reduce((sum, r) => sum + r.fileSize, 0) / validResults.length;
        const avgTime = validResults.reduce((sum, r) => sum + r.encodeTime, 0) / validResults.length;
        const avgCompression = validResults.reduce((sum, r) => sum + r.compressionRatio, 0) / validResults.length;

        const smallest = validResults.reduce((min, r) => r.fileSize < min.fileSize ? r : min);
        const fastest = validResults.reduce((min, r) => r.encodeTime < min.encodeTime ? r : min);
        const bestCompression = validResults.reduce((max, r) => r.compressionRatio > max.compressionRatio ? r : max);

        report.push(`Average file size: ${formatBytes(avgSize)}`);
        report.push(`Average encode time: ${formatTime(avgTime)}`);
        report.push(`Average compression: ${avgCompression.toFixed(1)}%`);
        report.push("");
        report.push(`Smallest file: ${smallest.name} (${formatBytes(smallest.fileSize)})`);
        report.push(`Fastest encode: ${fastest.name} (${formatTime(fastest.encodeTime)})`);
        report.push(`Best compression: ${bestCompression.name} (${bestCompression.compressionRatio.toFixed(1)}%)`);
    }

    // Recommendations
    report.push("");
    report.push("Recommendations:");
    report.push("================");
    report.push("• Use RGBA 8-bit for general purpose images with transparency");
    report.push("• Use RGB 8-bit for images without transparency (25% smaller)");
    report.push("• Use Grayscale 8-bit for black & white images (75% smaller)");
    report.push("• Use Palette formats for images with limited colors");
    report.push("• Use 16-bit formats only when high precision is required");
    report.push("• Use 1-4 bit formats for simple graphics and icons");

    // Write report
    await Deno.writeTextFile("example/png_summary_report.txt", report.join("\n"));
}

// Run the demo if this script is executed directly
if (import.meta.main) {
    try {
        await runPNGExportDemo();
    } catch (error) {
        console.error("❌ Demo failed:", (error as Error).message);
        Deno.exit(1);
    }
}
