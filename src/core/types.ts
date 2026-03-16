/**
 * Color encoding types for BLP files.
 * 1 = palettized (RAW1), 2 = DXT (DXT1/3/5), 3 = uncompressed (A8R8G8B8/RAW3)
 */
export enum BLPColorEncoding {
    PALETTE = 1,
    DXT = 2,
    ARGB8888 = 3,
}

/**
 * Pixel format types for BLP files.
 * Used for DXT and ARGB formats.
 */
export enum BLPPixelFormat {
    DXT1 = 0,
    DXT3 = 1,
    DXT5 = 7,
    ARGB8888 = 4,
    ARGB1555 = 5,
    ARGB4444 = 6,
}

/**
 * Represents the parsed header of a BLP2 file.
 * Follows the BLP2 specification as used in Blizzard games (e.g., World of Warcraft).
 * All fields are parsed directly from the file's binary header.
 */
export interface BLPHeader {
    /**
     * Magic number, always 'BLP2' for BLP2 files.
     * Used to verify file type.
     */
    magic: string;
    /**
     * Version number, always 1 for BLP2 files.
     */
    version: number;
    /**
     * Compression type (color encoding):
     *   1 = palettized (RAW1),
     *   2 = DXT (DXT1/3/5),
     *   3 = uncompressed (A8R8G8B8/RAW3)
     */
    compression: BLPColorEncoding;
    /**
     * Alpha channel bit depth:
     *   0 = no alpha,
     *   1 = 1-bit alpha,
     *   4 = 4-bit alpha (rare),
     *   8 = 8-bit alpha (most common for DXT5)
     * For DXT, 8 means DXT5, 1 means DXT1 with 1-bit alpha.
     */
    alphaSize: number;
    /**
     * Preferred format or internal alpha hint (usage varies, often 0, 1, 2, 4, or 8).
     * May be used for internal format selection or alpha representation.
     */
    preferredFormat: number;
    /**
     * Mipmap presence flag:
     *   0 = only one mipmap (level 0),
     *   1 or 2 = multiple mipmaps present (levels 0-9 or more)
     */
    hasMips: number;
    /**
     * Width of the main image (level 0), in pixels. Always a power of two.
     */
    width: number;
    /**
     * Height of the main image (level 0), in pixels. Always a power of two.
     */
    height: number;
    /**
     * Array of byte offsets (length 16) for each mipmap level (0 = unused).
     * Points to the start of each mipmap's data in the file.
     */
    mipOffsets: number[];
    /**
     * Array of byte sizes (length 16) for each mipmap level (0 = unused).
     * Indicates the size in bytes of each mipmap's data.
     * For DXT, may be inaccurate for small mipmaps—calculate size as needed.
     */
    mipSizes: number[];
}
/**
 * Content/compression type for BLP1 files (uint32 at offset 0x04).
 */
export enum BLP1ContentType {
    JPEG = 0,
    PALETTE = 1,
}

/**
 * Parsed header of a BLP1 file (Warcraft III, 156 bytes).
 */
export interface BLP1Header {
    magic: "BLP1";
    /** 0 = JPEG, 1 = Palette */
    content: BLP1ContentType;
    /** Alpha bit depth stored as uint32 (0, 1, 4, or 8). */
    alphaBitDepth: number;
    width: number;
    height: number;
    /** Purpose unclear; typically 4 or 5. */
    extra: number;
    /** 0 = no mipmaps, nonzero = mipmaps present. */
    hasMipmaps: number;
    mipOffsets: number[];
    mipSizes: number[];
}

/** Discriminated union covering both BLP versions. */
export type BlpHeader = BLPHeader | BLP1Header;

/** Type guard — returns true when the header belongs to a BLP1 file. */
export function isBLP1Header(header: BlpHeader): header is BLP1Header {
    return header.magic === "BLP1";
}

/**
 * Represents a single mipmap level's data in a BLP file.
 */
export interface BLPMipmapData {
    /** The width of the mipmap in pixels. */
    width: number;
    /** The height of the mipmap in pixels. */
    height: number;
    /** The byte offset of the mipmap data within the file. */
    offset: number;
    /** The size of the mipmap data in bytes. */
    size: number;
    /** The raw byte data of the mipmap. */
    data: Uint8Array;
}

/**
 * Represents a fully decoded image in RGBA format.
 */
export interface DecodedImage {
    /** The width of the decoded image in pixels. */
    width: number;
    /** The height of the decoded image in pixels. */
    height: number;
    /** The decoded image data as a flat array of RGBA pixel values. */
    pixels: Uint8Array; // RGBA
}
