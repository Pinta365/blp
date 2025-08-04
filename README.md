# BLP: Blizzard Picture (BLP) File Parser & Converter for TypeScript

A TypeScript library for reading, parsing, and converting Blizzard's proprietary BLP texture files (used in Warcraft III, World of Warcraft, etc.) to
standard image formats. Supports BLP2, palettized, DXT-compressed, and uncompressed formats.

This library can run cross runtime agnostic (Deno, Node and Bun primary) but not tested yet.

**Features:**

- **BLP Decoding**: BLP2 header parsing and validation, with access to all image metadata
- **BLP Encoding**: Create BLP files from RGBA pixel data with various compression options
- **Automatic Format Detection**: Supports palettized (RAW1), DXT-compressed (DXT1, DXT3, DXT5), and uncompressed (RAW3) images
- **Smart Resizing**: Automatic resizing of non-power-of-2 images with padding modes that preserve entire image content
- **Mipmap Support**: Extraction of all mipmap levels and related metadata
- **PNG Decoding**: Read PNG files and convert to RGBA pixel data
- **PNG Encoding**: Convert BLP images to PNG with support for multiple formats (RGBA, RGB, Grayscale, Palette, Grayscale+Alpha) and bit depths (1, 2,
  4, 8, 16-bit)

## Installing

This package is published on [JSR](https://jsr.io/@pinta365/blp), the JavaScript Registry. You can install it with your preferred package manager:

| Package Manager | Command                         |
| :-------------- | :------------------------------ |
| Deno            | `deno add jsr:@pinta365/blp`    |
| npm             | `npx jsr add @pinta365/blp`     |
| Bun             | `bunx jsr add @pinta365/blp`    |
| pnpm            | `pnpm i jsr:@pinta365/blp`      |
| yarn            | `yarn add jsr:@pinta365/blp`    |
| vlt             | `vlt install jsr:@pinta365/blp` |

## Usage Examples

### BLP to PNG Conversion

The easiest way to decode a BLP file is with the `decodeBlpData` helper and there are both auto and manual support for png encoding:

```ts
import { decodeBlpData, encodeToPNG, encodeToPNGAuto, PNGColorType } from "@pinta365/blp";

const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
const decoded = decodeBlpData(data); //The decoded main image as a DecodedImage (RGBA pixel data).

// Basic PNG export with auto format detection based on image content analysis.
const png = await encodeToPNGAuto(decoded);
await Deno.writeFile("output.png", png);

// Advanced PNG export with different formats
const grayscalePNG = await encodeToPNG(decoded, {
    colorType: PNGColorType.GRAYSCALE,
    bitDepth: 8,
});
const rbgPNG = await encodeToPNG(decoded, {
    colorType: PNGColorType.RGB,
    bitDepth: 8,
});
```

### Analyze image content for format recommendations and insight

```ts
import { analyzeImageForPNG, decodeBlpData } from "@pinta365/blp";

const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
const decoded = decodeBlpData(data);

// Analyze image content for format recommendations
const analysis = analyzeImageForPNG(decoded);
console.log(`Recommended format: ${analysis.recommendedFormat.colorType}`);
console.log(`Unique colors: ${analysis.uniqueColors}`);
console.log(`Has alpha: ${analysis.hasAlpha}`);
console.log(`Is grayscale: ${analysis.isGrayscale}`);

// Show all alternative formats
analysis.alternatives.forEach((alt, index) => {
    console.log(`${index + 1}. ${alt.format.colorType} - ${alt.reason} (${alt.estimatedSize})`);
});
```

Auto mode analyzes:

- **Grayscale detection**: Automatically uses grayscale format for monochrome images
- **Alpha channel analysis**: Detects binary vs. full alpha, chooses appropriate format
- **Color palette analysis**: Suggests palette mode for images with limited colors
- **Transparency analysis**: Optimizes for images with transparent areas
- **Size optimization**: Recommends smaller formats when quality loss is acceptable

### PNG to BLP Conversion

Convert PNG images to BLP format with various compression options and automatic resizing:

```ts
import { BLPColorEncoding, BLPPixelFormat, decodePNGData, encodeToBLP, ResizeMode } from "@pinta365/blp";

// Read and decode PNG
const pngData = await Deno.readFile("image.png");
const decodedImage = await decodePNGData(pngData);

// Encode to BLP with DXT5 compression and auto-resizing
const blpData = encodeToBLP(decodedImage, {
    compression: BLPColorEncoding.DXT,
    alphaSize: 8,
    preferredFormat: BLPPixelFormat.DXT5,
    generateMipmaps: true,
    resizeMode: ResizeMode.PAD_CENTER,
    autoResize: true,
});

await Deno.writeFile("output.blp", blpData);
```

### Round-trip Conversion

Simple round-trip testing:

```ts
import { decodeBlpData, decodePNGData, encodeToBLP, encodeToPNG } from "@pinta365/blp";

// PNG → BLP → PNG
const originalPng = await Deno.readFile("original.png");
const decodedImage = await decodePNGData(originalPng);
const blpData = encodeToBLP(decodedImage);
const roundTripImage = decodeBlpData(blpData);
const finalPng = await encodeToPNG(roundTripImage);

await Deno.writeFile("roundtrip.png", finalPng);
```

Get header data.

```ts
import { describeBLPHeader } from "@pinta365/blp";

const data = await Deno.readFile("./samples/64x64_DXT1.blp");
const header = describeBLPHeader(data);

console.log(header);
// Outputs:
//
// Magic: BLP2 (should be 'BLP2')
// Version: 1 (should be 1)
// Compression: 2 (DXT-compressed (DXT1/3/5))
// Alpha size: 0 (No alpha channel)
// Preferred format: 0 (Default/unspecified)
// Mipmaps: Unknown (17)
// Width: 64 px
// Height: 64 px
// Mipmap offsets: [1172, 3220, 3732, 3860, 3892, 3900, 3908, 0, 0, 0, 0, 0, 0, 0, 0, 0]
// Mipmap sizes: [2048, 512, 128, 32, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0]
// DXT type: DXT1 (preferredFormat=0 or 2, alphaSize=0 or 1)
//   (DXT type is determined by preferredFormat and alphaSize fields)
```

---

## API Overview

### Core Decoding Functions

- **decodeBlpData(data: Uint8Array): DecodedImage**\
  Decodes a BLP file (auto-detects format) and returns RGBA pixel data.

- **decodePNGData(data: Uint8Array, options?: PNGDecodeOptions): Promise<DecodedImage>**\
  Decodes a PNG file and returns RGBA pixel data.

### Core Encoding Functions

- **encodeToBLP(image: DecodedImage, options?: BLPEncodeOptions): Uint8Array**\
  Encodes RGBA pixel data to BLP format with various compression options.

- **encodeToPNG(image: DecodedImage, options?: PNGEncodeOptions): Promise<Uint8Array>**\
  Encode RGBA data to PNG with specified format.

- **encodeToPNGAuto(image: DecodedImage, options?: PNGAutoOptions): Promise<Uint8Array>**\
  Encode RGBA data to PNG with automatic format detection.

### BLP Header and Metadata

- **parseBlpHeader(data: Uint8Array): BLPHeader**\
  Parse the BLP2 header and return metadata.

- **describeBLPHeader(data: Uint8Array): string**\
  Returns a human-readable technical summary of the BLP header, including DXT type and field explanations.

- **extractMipmaps(data: Uint8Array, header: BLPHeader): BLPMipmapData[]**\
  Extract mipmap data blocks.

### PNG Analysis and Optimization

- **analyzeImageForPNG(image: DecodedImage, options?: PNGAutoOptions): ImageAnalysis**\
  Analyze image content and provide detailed format recommendations.

- **detectOptimalPNGFormat(image: DecodedImage, options?: PNGAutoOptions): PNGEncodeOptions**\
  Detect the optimal PNG format based on image content analysis.

### BLP Convenience Encoders

- **encodeToDXT1BLP(image: DecodedImage, generateMipmaps?: boolean): Uint8Array**\
  Convenience function to encode as DXT1 BLP.

- **encodeToDXT3BLP(image: DecodedImage, generateMipmaps?: boolean): Uint8Array**\
  Convenience function to encode as DXT3 BLP.

- **encodeToDXT5BLP(image: DecodedImage, generateMipmaps?: boolean): Uint8Array**\
  Convenience function to encode as DXT5 BLP.

- **encodeToPaletteBLP(image: DecodedImage, alphaSize?: number, generateMipmaps?: boolean): Uint8Array**\
  Convenience function to encode as palettized BLP.

- **encodeToUncompressedBLP(image: DecodedImage, generateMipmaps?: boolean): Uint8Array**\
  Convenience function to encode as uncompressed BLP.

### PNG Convenience Encoders

- **encodeToGrayscalePNG(image: DecodedImage, bitDepth?: number): Promise<Uint8Array>**\
  Convenience function to encode as grayscale PNG.

- **encodeToRGBPNG(image: DecodedImage, bitDepth?: number): Promise<Uint8Array>**\
  Convenience function to encode as RGB PNG.

- **encodeToPalettePNG(image: DecodedImage, bitDepth?: number): Promise<Uint8Array>**\
  Convenience function to encode as palette-based PNG.

- **encodeToGrayscaleAlphaPNG(image: DecodedImage, bitDepth?: number): Promise<Uint8Array>**\
  Convenience function to encode as grayscale with alpha PNG.

### DXT Compression Functions

- **decompressDXT1(data: Uint8Array, width: number, height: number): DecodedImage**\
  Decompress DXT1-compressed images.

- **decompressDXT3(data: Uint8Array, width: number, height: number): DecodedImage**\
  Decompress DXT3-compressed images.

- **decompressDXT5(data: Uint8Array, width: number, height: number): DecodedImage**\
  Decompress DXT5-compressed images.

- **compressDXT1(image: DecodedImage): Uint8Array**\
  Compress image to DXT1 format.

- **compressDXT3(image: DecodedImage): Uint8Array**\
  Compress image to DXT3 format.

- **compressDXT5(image: DecodedImage): Uint8Array**\
  Compress image to DXT5 format.

- **compressDXT1Block(pixels: Uint8Array): Uint8Array**\
  Compress a 4x4 RGBA block to DXT1 format.

- **compressDXT3Block(pixels: Uint8Array): Uint8Array**\
  Compress a 4x4 RGBA block to DXT3 format.

- **compressDXT5Block(pixels: Uint8Array): Uint8Array**\
  Compress a 4x4 RGBA block to DXT5 format.

### Palette Compression Functions

- **decompressRAW1(data: Uint8Array, width: number, height: number, palette: Uint8Array, alphaSize: number): DecodedImage**\
  Decompress palettized (RAW1) images.

- **decompressRAW3(data: Uint8Array, width: number, height: number): DecodedImage**\
  Decompress uncompressed (RAW3) images.

- **compressRAW1(image: DecodedImage, alphaSize?: number): Uint8Array**\
  Compress image to palettized format (RAW1).

- **compressRAW3(image: DecodedImage): Uint8Array**\
  Compress image to uncompressed ARGB8888 format (RAW3).

- **generatePalette(pixels: Uint8Array, maxColors?: number): { palette: Uint8Array; indices: Uint8Array }**\
  Generate a color palette from RGBA pixel data.

### Image Resizing Functions

- **autoResizeToPowerOf2(image: DecodedImage, mode?: ResizeMode, preferLarger?: boolean, fillColor?: { r: number; g: number; b: number; a: number }):
  DecodedImage**\
  Auto-resize an image to the nearest power-of-2 dimensions.

- **resizeImage(image: DecodedImage, options: ResizeOptions): DecodedImage**\
  Resize an image to the specified dimensions.

- **padToPowerOf2(image: DecodedImage, preferLarger?: boolean, fillColor?: { r: number; g: number; b: number; a: number }): DecodedImage**\
  Convenience function for padding to power of 2.

- **centerPadToPowerOf2(image: DecodedImage, preferLarger?: boolean, fillColor?: { r: number; g: number; b: number; a: number }): DecodedImage**\
  Convenience function for center padding to power of 2.

- **nextPowerOf2(n: number): number**\
  Find the nearest power of 2 that is greater than or equal to the given number.

- **prevPowerOf2(n: number): number**\
  Find the nearest power of 2 that is less than or equal to the given number.

- **closestPowerOf2(n: number): number**\
  Find the closest power of 2 to the given number.

- **calculateOptimalDimensions(width: number, height: number, preferLarger?: boolean): { width: number; height: number }**\
  Calculate optimal power-of-2 dimensions for an image.

### Utility Functions

- **uint8ArrayToStream(u8: Uint8Array): ReadableStream<Uint8Array>**\
  Convert a Uint8Array to a ReadableStream for streaming APIs.

### Type Definitions

- **BLPHeader**: Represents the parsed header of a BLP2 file
- **BLPMipmapData**: Represents a single mipmap level's data
- **DecodedImage**: Represents a fully decoded image in RGBA format
- **BLPColorEncoding**: Enum for BLP color encoding types (PALETTE, DXT, ARGB8888)
- **BLPPixelFormat**: Enum for BLP pixel format types (DXT1, DXT3, DXT5, ARGB8888, etc.)
- **PNGColorType**: Enum for PNG color types (GRAYSCALE, RGB, PALETTE, GRAYSCALE_ALPHA, RGBA)
- **ResizeMode**: Enum for resizing modes (FORCE, PAD, PAD_CENTER)
- **ImageAnalysis**: Detailed analysis of image content for format optimization
- **BLPEncodeOptions**: Options for BLP encoding
- **PNGEncodeOptions**: Options for PNG encoding
- **PNGAutoOptions**: Auto-detection options for PNG encoding
- **PNGDecodeOptions**: Options for PNG decoding
- **ResizeOptions**: Options for image resizing

See the source files on [`JSR`](https://jsr.io/@pinta365/blp/doc) for full API documentation and type definitions.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
