# PNG Export Guide

This guide covers the PNG export capabilities of the BLP library, which now supports multiple color types and bit depths.

### Color Types

| Color Type        | Value | Description                  | Supported Bit Depths |
| ----------------- | ----- | ---------------------------- | -------------------- |
| Grayscale         | 0     | Single channel grayscale     | 1, 2, 4, 8, 16       |
| RGB               | 2     | Three channel RGB            | 8, 16                |
| Palette           | 3     | Indexed color with palette   | 1, 2, 4, 8           |
| Grayscale + Alpha | 4     | Grayscale with alpha channel | 8, 16                |
| RGBA              | 6     | RGB with alpha channel       | 8, 16                |

### Bit Depths

- **1-bit**: Binary images (black/white)
- **2-bit**: 4-level grayscale
- **4-bit**: 16-level grayscale or 16-color palette
- **8-bit**: 256-level grayscale, 256-color palette, or 8-bit per channel RGB/RGBA
- **16-bit**: 65536-level grayscale or 16-bit per channel RGB/RGBA

## Basic Usage

### Simple RGBA Export (Default)

```typescript
import { decodeBlpData, encodeToPNG } from "./mod.ts";

const blpData = await Deno.readFile("image.blp");
const decodedImage = decodeBlpData(blpData);
const pngData = await encodeToPNG(decodedImage);
await Deno.writeFile("output.png", pngData);
```

### Custom Format Export

```typescript
import { decodeBlpData, encodeToPNG, PNGColorType } from "./mod.ts";

const decodedImage = decodeBlpData(blpData);

// Export as 8-bit grayscale
const grayscalePNG = await encodeToPNG(decodedImage, {
    colorType: PNGColorType.GRAYSCALE,
    bitDepth: 8,
});

// Export as 4-bit palette (16 colors)
const palettePNG = await encodeToPNG(decodedImage, {
    colorType: PNGColorType.PALETTE,
    bitDepth: 4,
});

// Export as 16-bit RGB
const rgb16PNG = await encodeToPNG(decodedImage, {
    colorType: PNGColorType.RGB,
    bitDepth: 16,
});
```

## Convenience Functions

For common use cases, the library provides convenience functions:

```typescript
import { encodeToGrayscaleAlphaPNG, encodeToGrayscalePNG, encodeToPalettePNG, encodeToRGBPNG } from "./src/formats/png.ts";

// Grayscale exports
const gray8bit = await encodeToGrayscalePNG(decodedImage, 8);
const gray4bit = await encodeToGrayscalePNG(decodedImage, 4);

// RGB exports
const rgb8bit = await encodeToRGBPNG(decodedImage, 8);
const rgb16bit = await encodeToRGBPNG(decodedImage, 16);

// Palette exports
const palette8bit = await encodeToPalettePNG(decodedImage, 8);
const palette4bit = await encodeToPalettePNG(decodedImage, 4);

// Grayscale with alpha
const grayAlpha = await encodeToGrayscaleAlphaPNG(decodedImage, 8);
```

## Advanced Options

### Custom Palette

For palette-based images, you can provide a custom palette:

```typescript
const customPalette = new Uint8Array([
    255,
    0,
    0,
    255, // Red
    0,
    255,
    0,
    255, // Green
    0,
    0,
    255,
    255, // Blue
    // ... more colors
]);

const customPalettePNG = await encodeToPNG(decodedImage, {
    colorType: PNGColorType.PALETTE,
    bitDepth: 8,
    palette: customPalette,
});
```

## Format Selection Guidelines

### When to Use Each Format

**RGBA (8-bit)**

- Default choice for most images
- Best quality, larger file size
- Use when alpha transparency is needed

**RGB (8-bit)**

- Use when alpha channel is not needed
- Smaller file size than RGBA
- Good for photographs and complex images

**Grayscale (8-bit)**

- Use for black and white images
- Significantly smaller file size
- Good for text, icons, and simple graphics

**Grayscale (4-bit)**

- Use for simple graphics with limited shades
- Very small file size
- Good for icons and simple UI elements

**Palette (8-bit)**

- Use for images with limited color palette
- Good compression for cartoon-style graphics
- Automatic color reduction for complex images

**Palette (4-bit)**

- Use for very simple graphics
- Maximum compression
- Limited to 16 colors

**Grayscale + Alpha (8-bit)**

- Use for grayscale images with transparency
- Good for UI elements and icons
- Smaller than RGBA for grayscale content

## Performance Considerations

### File Size Comparison

Based on actual testing with various BLP images:

| Format                   | Typical Size Range | Compression vs RGBA |
| ------------------------ | ------------------ | ------------------- |
| RGBA 8-bit               | 3.8 - 112 KB       | Baseline            |
| RGB 8-bit                | 4.0 - 69 KB        | 0-40% smaller       |
| Grayscale 8-bit          | 2.3 - 30 KB        | 35-75% smaller      |
| Grayscale 4-bit          | 1.0 - 10 KB        | 70-90% smaller      |
| Grayscale 2-bit          | 0.5 - 5 KB         | 80-95% smaller      |
| Grayscale 1-bit          | 0.1 - 4 KB         | 90-99% smaller      |
| Palette 8-bit            | 3.1 - 36 KB        | 20-80% smaller      |
| Palette 4-bit            | 1.1 - 19 KB        | 60-95% smaller      |
| Palette 2-bit            | 0.6 - 10 KB        | 80-98% smaller      |
| Palette 1-bit            | 0.3 - 4 KB         | 90-99% smaller      |
| Grayscale + Alpha 8-bit  | 2.4 - 74 KB        | 15-70% smaller      |
| Grayscale + Alpha 16-bit | 3.0 - 104 KB       | 10-60% smaller      |

**Note**: Actual file sizes vary significantly based on image content, complexity, and compression efficiency. Simple images with limited colors
achieve much better compression than complex, detailed images.

### Processing Speed

Based on actual performance testing:

- **RGBA/RGB**: Fastest processing (1-25ms typical)
- **Grayscale**: Fast processing with color conversion (1-16ms typical)
- **Grayscale + Alpha**: Moderate speed (1-23ms typical)
- **Palette**: Slower due to color analysis and reduction (1-119ms typical)
- **16-bit formats**: Slightly slower than 8-bit equivalents due to larger data size

**Note**: Processing time varies based on image size and complexity. Simple images process faster than complex ones. **Note**: Calculations done by AI
:) GLHF

## Error Handling

The library validates format combinations and provides clear error messages:

```typescript
try {
    const png = await encodeToPNG(decodedImage, {
        colorType: PNGColorType.RGB,
        bitDepth: 4, // Invalid: RGB only supports 8 or 16 bit
    });
} catch (error) {
    console.error(error.message); // "Invalid bit depth 4 for color type 2"
}
```

## Complete Example

```typescript
import { decodeBlpData, encodeToPNG, PNGColorType } from "./mod.ts";

async function exportMultipleFormats(blpPath: string) {
    const blpData = await Deno.readFile(blpPath);
    const decodedImage = decodeBlpData(blpData);

    const formats = [
        { name: "rgba", options: { colorType: PNGColorType.RGBA, bitDepth: 8 } },
        { name: "rgb", options: { colorType: PNGColorType.RGB, bitDepth: 8 } },
        { name: "grayscale", options: { colorType: PNGColorType.GRAYSCALE, bitDepth: 8 } },
        { name: "palette", options: { colorType: PNGColorType.PALETTE, bitDepth: 8 } },
    ];

    for (const format of formats) {
        const pngData = await encodeToPNG(decodedImage, format.options);
        await Deno.writeFile(`output_${format.name}.png`, pngData);
        console.log(`Exported ${format.name}.png (${pngData.length} bytes)`);
    }
}
```
