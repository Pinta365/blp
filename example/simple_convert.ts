import { decodeBlpData, encodeToPNG } from "../mod.ts";

// Paths
const inputPath = "../samples/blp/64x64_DXT1.blp";
const outputPath = "../samples/blp/output/simple_convert.png";

// Read the BLP file
const data = await Deno.readFile(inputPath);

// Decode to RGBA pixel data
const decoded = decodeBlpData(data);

// Encode to PNG
const png = await encodeToPNG(decoded);

// Write the PNG file
await Deno.writeFile(outputPath, png);

console.log(`Converted ${inputPath} to ${outputPath}`);
