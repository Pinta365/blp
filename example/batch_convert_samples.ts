import { decodeBlpData, encodeToPNG, extractMipmaps, parseBlpHeader } from "../mod.ts";

const samplesDir = "../samples/blp";
const summaryPath = "./batch_summary.txt";

async function convertFile(filePath: string): Promise<string> {
    try {
        const data = await Deno.readFile(filePath);
        const decoded = decodeBlpData(data);
        const header = parseBlpHeader(data);
        const mipmaps = extractMipmaps(data, header);
        const png = await encodeToPNG(decoded);
        const outPath = filePath.replace(samplesDir, samplesDir + "/output").replace(/\.blp$/i, ".png");
        await Deno.writeFile(outPath, png);
        const info = [
            `size=${header.width}x${header.height}`,
            `compression=${header.compression}`,
            `alphaSize=${header.alphaSize}`,
            `preferredFormat=${header.preferredFormat}`,
            `mipmaps=${mipmaps.length}`,
        ].join(", ");
        return `${filePath}: Success (${info}) -> ${outPath}`;
    } catch (err) {
        return `${filePath}: ERROR: ${err}`;
    }
}

async function main() {
    const entries = [];
    for await (const dirEntry of Deno.readDir(samplesDir)) {
        if (dirEntry.isFile && dirEntry.name.toLowerCase().endsWith(".blp")) {
            entries.push(`${samplesDir}/${dirEntry.name}`);
        }
    }
    const results: string[] = [];
    for (const file of entries) {
        const result = await convertFile(file);
        console.log(result);
        results.push(result);
    }
    await Deno.writeTextFile(summaryPath, results.join("\n"));
}

if (import.meta.main) {
    main();
}
