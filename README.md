# BLP: Blizzard Picture (BLP) File Parser & Converter for TypeScript

A TypeScript library for reading, parsing, and converting Blizzard’s proprietary BLP texture files (used in Warcraft III, World of Warcraft, etc.) to
standard image formats. Supports BLP2, palettized, DXT-compressed, and uncompressed formats.

This library be run cross runtime agnostic (Deno, Node and Bun primary) but not tested yet. The example files are using Deno apis though.

**Features:**

- BLP2 header parsing and validation, with access to all image metadata
- Automatic detection and decoding of:
  - Palettized (RAW1) images
  - DXT-compressed images (DXT1, DXT3, DXT5)
  - Uncompressed (RAW3) images
- Extraction of all mipmap levels and related metadata
- Conversion of BLP image data to standard RGBA pixel buffers
- PNG export with support for multiple formats: RGBA, RGB, Grayscale, Palette, and Grayscale+Alpha with various bit depths (1, 2, 4, 8, 16-bit)

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

## Usage Example

The easiest way to decode a BLP file is with the `decodeBlpData` helper:

```ts
import { decodeBlpData, encodeToPNG, PNGColorType } from "@pinta365/blp";

const data = await Deno.readFile("samples/blp/64x64_DXT1.blp");
const decoded = decodeBlpData(data); //The decoded main image as a DecodedImage (RGBA pixel data).

// Basic PNG export (RGBA 8-bit)
const png = await encodeToPNG(decoded);
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

Get header data.

```ts
import { describeHeader } from "@pinta365/blp";

const data = await Deno.readFile("../samples/64x64_DXT1.blp");
const header = describeHeader(data);

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

See [`example/simple_convert.ts`](example/simple_convert.ts) for a minimal working example.

For advanced use (e.g., batch conversion, header inspection), see [`example/batch_convert_samples.ts`](example/batch_convert_samples.ts).

For PNG export examples with different formats, see [`example/png_export_demo.ts`](example/png_export_demo.ts) and
[`PNG_EXPORT_GUIDE.md`](PNG_EXPORT_GUIDE.md).

---

## API Overview

- **decodeBlpData(data: Uint8Array): DecodedImage**\
  Decodes a BLP file (auto-detects format) and returns RGBA pixel data.

- **describeHeader(data: Uint8Array): string**\
  Returns a human-readable technical summary of the BLP header, including DXT type and field explanations.

- **parseBlpHeader(data: Uint8Array): BLPHeader**\
  Parse the BLP2 header and return metadata.

- **extractMipmaps(data: Uint8Array, header: BLPHeader): BLPMipmapData[]**\
  Extract mipmap data blocks.

- **decompressRAW1(data, width, height, palette, alphaSize): DecodedImage**\
  Decompress palettized (RAW1) images.

- **decompressRAW3(data, width, height): DecodedImage**\
  Decompress uncompressed (RAW3) images.

- **decompressDXT1/3/5(data, width, height): DecodedImage**\
  Decompress DXT-compressed images.

- **encodeToPNG(image: DecodedImage): Promise<Uint8Array>**\
  Encode RGBA data to PNG.

See the source files on [`JSR`](https://jsr.io/@pinta365/blp/doc) for full API documentation and type definitions.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
