/**
 * Pure-JS JPEG decoder internalized from @cross/image.
 *
 * Supports baseline DCT (SOF0) and progressive DCT (SOF2) with
 * spectral selection and successive approximation. Handles 1, 3,
 * and 4 component images with subsampling.
 *
 * The `colorTransform` option allows skipping Y'CbCr-to-RGB conversion,
 * which is critical for BLP1 files that store raw BGRA in JPEG channels.
 *
 * Origin: @cross/image (MIT) — src/utils/jpeg_decoder.ts
 */

// ---------------------------------------------------------------------------
// Minimal types (subset of @cross/image/types.ts)
// ---------------------------------------------------------------------------

interface JPEGDecoderOptions {
    tolerantDecoding?: boolean;
    onWarning?: (message: string, details?: unknown) => void;
    /**
     * false  = skip colour-space conversion, output raw component values
     * true   = force Y'CbCr-to-RGB
     * undefined = auto (standard behaviour)
     */
    colorTransform?: boolean;
    extractCoefficients?: boolean;
}

interface JPEGComponent {
    id: number;
    h: number;
    v: number;
    qTable: number;
    dcTable: number;
    acTable: number;
    pred: number;
    blocks: (number[] | Int32Array)[][];
}

interface HuffmanTable {
    codes: Map<number, number>;
    maxCode: Int32Array;
    minCode: Int32Array;
    valPtr: Int32Array;
    huffVal: Uint8Array;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EOI = 0xffd9;
const SOS = 0xffda;
const DQT = 0xffdb;
const DHT = 0xffc4;
const SOF0 = 0xffc0;
const SOF2 = 0xffc2;
const DRI = 0xffdd;

const ZIGZAG = [
    0,
    1,
    8,
    16,
    9,
    2,
    3,
    10,
    17,
    24,
    32,
    25,
    18,
    11,
    4,
    5,
    12,
    19,
    26,
    33,
    40,
    48,
    41,
    34,
    27,
    20,
    13,
    6,
    7,
    14,
    21,
    28,
    35,
    42,
    49,
    56,
    57,
    50,
    43,
    36,
    29,
    22,
    15,
    23,
    30,
    37,
    44,
    51,
    58,
    59,
    52,
    45,
    38,
    31,
    39,
    46,
    53,
    60,
    61,
    54,
    47,
    55,
    62,
    63,
];

class EndOfScanError extends Error {
    constructor(message = "End of scan marker detected") {
        super(message);
        this.name = "EndOfScanError";
    }
}

// ---------------------------------------------------------------------------
// Dimension limits (from @cross/image security.ts)
// ---------------------------------------------------------------------------

const MAX_IMAGE_DIMENSION = 65535;
const MAX_IMAGE_PIXELS = 178956970;

function validateImageDimensions(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
        throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        throw new Error(`Invalid image dimensions: ${width}x${height} (must be integers)`);
    }
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        throw new Error(`Image dimensions too large: ${width}x${height}`);
    }
    if (width * height > MAX_IMAGE_PIXELS) {
        throw new Error(`Image pixel count too large: ${width}x${height}`);
    }
}

// ---------------------------------------------------------------------------
// JPEGDecoder
// ---------------------------------------------------------------------------

class JPEGDecoder {
    private data: Uint8Array;
    private pos = 0;
    private width = 0;
    private height = 0;
    private components: JPEGComponent[] = [];
    private qTables: (number[] | Uint8Array)[] = [];
    private dcTables: HuffmanTable[] = [];
    private acTables: HuffmanTable[] = [];
    private restartInterval = 0;
    private bitBuffer = 0;
    private bitCount = 0;
    private options: {
        tolerantDecoding: boolean;
        onWarning?: (message: string, details?: unknown) => void;
        extractCoefficients: boolean;
        colorTransform?: boolean;
    };
    private isProgressive = false;
    private spectralStart = 0;
    private spectralEnd = 63;
    private successiveHigh = 0;
    private successiveLow = 0;
    private scanComponentIds: number[] = [];
    private eobRun = 0;

    constructor(data: Uint8Array, settings: JPEGDecoderOptions = {}) {
        this.data = data;
        this.options = {
            tolerantDecoding: settings.tolerantDecoding ?? true,
            onWarning: settings.onWarning,
            extractCoefficients: settings.extractCoefficients ?? false,
            colorTransform: settings.colorTransform,
        };
    }

    getWidth(): number {
        return this.width;
    }
    getHeight(): number {
        return this.height;
    }

    decode(): Uint8Array {
        if (this.data.length < 2 || this.data[0] !== 0xff || this.data[1] !== 0xd8) {
            throw new Error("Invalid JPEG signature");
        }
        this.pos = 2;

        while (this.pos < this.data.length) {
            const marker = this.readMarker();

            if (marker === EOI) {
                break;
            } else if (marker === SOS) {
                this.parseSOS();
                this.decodeScan();
                if (!this.isProgressive) break;
            } else if (marker === DQT) {
                this.parseDQT();
            } else if (marker === DHT) {
                this.parseDHT();
            } else if (marker === SOF0 || marker === SOF2) {
                this.parseSOF();
                this.isProgressive = marker === SOF2;
            } else if (marker === DRI) {
                this.parseDRI();
            } else if (marker >= 0xffe0 && marker <= 0xffef) {
                this.skipSegment();
            } else if (marker >= 0xffc0 && marker <= 0xffcf) {
                if (marker !== 0xffc4 && marker !== 0xffc8 && marker !== 0xffcc) {
                    throw new Error(`Unsupported JPEG type: marker 0x${marker.toString(16)}`);
                }
            } else {
                if (this.pos < this.data.length) this.skipSegment();
            }
        }

        if (this.width === 0 || this.height === 0) {
            throw new Error("Failed to decode JPEG: invalid dimensions");
        }

        if (this.isProgressive && !this.options.extractCoefficients) {
            for (const component of this.components) {
                if (component.blocks) {
                    for (const row of component.blocks) {
                        for (const block of row) {
                            this.idct(block);
                        }
                    }
                }
            }
        }

        return this.convertToRGB();
    }

    // ------------------------------------------------------------------
    // Marker parsing
    // ------------------------------------------------------------------

    private readMarker(): number {
        while (this.pos < this.data.length && this.data[this.pos] !== 0xff) this.pos++;
        if (this.pos >= this.data.length - 1) return EOI;
        const byte1 = this.data[this.pos++];
        let byte2 = this.data[this.pos++];
        while (byte2 === 0xff && this.pos < this.data.length) byte2 = this.data[this.pos++];
        return (byte1 << 8) | byte2;
    }

    private readUint16(): number {
        const v = (this.data[this.pos] << 8) | this.data[this.pos + 1];
        this.pos += 2;
        return v;
    }

    private skipSegment(): void {
        const length = this.readUint16();
        this.pos += length - 2;
    }

    private parseDQT(): void {
        let length = this.readUint16() - 2;
        while (length > 0) {
            const info = this.data[this.pos++];
            const tableId = info & 0x0f;
            const precision = (info >> 4) & 0x0f;
            if (precision !== 0) throw new Error("16-bit quantization tables not supported");
            const table = new Uint8Array(64);
            for (let i = 0; i < 64; i++) table[ZIGZAG[i]] = this.data[this.pos++];
            this.qTables[tableId] = table;
            length -= 65;
        }
    }

    private parseDHT(): void {
        let length = this.readUint16() - 2;
        while (length > 0) {
            const info = this.data[this.pos++];
            const tableId = info & 0x0f;
            const tableClass = (info >> 4) & 0x0f;
            const bits = new Uint8Array(16);
            let numSymbols = 0;
            for (let i = 0; i < 16; i++) {
                bits[i] = this.data[this.pos++];
                numSymbols += bits[i];
            }
            const huffVal = new Uint8Array(numSymbols);
            for (let i = 0; i < numSymbols; i++) huffVal[i] = this.data[this.pos++];
            const table = this.buildHuffmanTable(bits, huffVal);
            if (tableClass === 0) this.dcTables[tableId] = table;
            else this.acTables[tableId] = table;
            length -= 17 + numSymbols;
        }
    }

    private buildHuffmanTable(bits: Uint8Array, huffVal: Uint8Array): HuffmanTable {
        const maxCode = new Int32Array(16).fill(-1);
        const minCode = new Int32Array(16).fill(-1);
        const valPtr = new Int32Array(16).fill(-1);
        const codes = new Map<number, number>();
        let code = 0;
        let valIndex = 0;
        for (let i = 0; i < 16; i++) {
            if (bits[i] > 0) {
                minCode[i] = code;
                valPtr[i] = valIndex;
                for (let j = 0; j < bits[i]; j++) {
                    codes.set((i << 16) | code, huffVal[valIndex]);
                    code++;
                    valIndex++;
                }
                maxCode[i] = code - 1;
                code <<= 1;
            } else {
                code <<= 1;
            }
        }
        return { codes, maxCode, minCode, valPtr, huffVal };
    }

    private parseSOF(): void {
        const _length = this.readUint16();
        const precision = this.data[this.pos++];
        if (precision !== 8) throw new Error(`Unsupported precision: ${precision}`);
        this.height = this.readUint16();
        this.width = this.readUint16();
        const numComponents = this.data[this.pos++];
        if (numComponents !== 1 && numComponents !== 3 && numComponents !== 4) {
            throw new Error(`Unsupported number of components: ${numComponents}`);
        }
        this.components = [];
        for (let i = 0; i < numComponents; i++) {
            const id = this.data[this.pos++];
            const samplingFactor = this.data[this.pos++];
            const qTable = this.data[this.pos++];
            this.components.push({
                id,
                h: (samplingFactor >> 4) & 0x0f,
                v: samplingFactor & 0x0f,
                qTable,
                dcTable: 0,
                acTable: 0,
                pred: 0,
                blocks: [],
            });
        }
    }

    private parseSOS(): void {
        const _length = this.readUint16();
        const numComponents = this.data[this.pos++];
        this.scanComponentIds = [];
        for (let i = 0; i < numComponents; i++) {
            const id = this.data[this.pos++];
            const tables = this.data[this.pos++];
            this.scanComponentIds.push(id);
            const component = this.components.find((c) => c.id === id);
            if (component) {
                component.dcTable = (tables >> 4) & 0x0f;
                component.acTable = tables & 0x0f;
            }
        }
        this.spectralStart = this.data[this.pos++];
        this.spectralEnd = this.data[this.pos++];
        const sa = this.data[this.pos++];
        this.successiveHigh = (sa >> 4) & 0x0f;
        this.successiveLow = sa & 0x0f;
    }

    private parseDRI(): void {
        const _length = this.readUint16();
        this.restartInterval = this.readUint16();
    }

    // ------------------------------------------------------------------
    // Entropy-coded scan decoding
    // ------------------------------------------------------------------

    private decodeScan(): void {
        const maxH = Math.max(...this.components.map((c) => c.h));
        const maxV = Math.max(...this.components.map((c) => c.v));
        const mcuWidth = Math.ceil(this.width / (8 * maxH));
        const mcuHeight = Math.ceil(this.height / (8 * maxV));

        this.bitBuffer = 0;
        this.bitCount = 0;
        this.eobRun = 0;
        for (const component of this.components) component.pred = 0;

        for (const component of this.components) {
            const blocksAcross = mcuWidth * component.h;
            const blocksDown = mcuHeight * component.v;
            if (!component.blocks || component.blocks.length === 0) {
                component.blocks = Array(blocksDown).fill(null).map(() => Array(blocksAcross).fill(null).map(() => new Int32Array(64)));
            }
        }

        if (this.scanComponentIds.length === 1) {
            const comp = this.components.find((c) => c.id === this.scanComponentIds[0]);
            if (!comp) return;
            const blocksAcross = mcuWidth * comp.h;
            const blocksDown = mcuHeight * comp.v;
            for (let bY = 0; bY < blocksDown; bY++) {
                for (let bX = 0; bX < blocksAcross; bX++) {
                    if (bY >= comp.blocks.length || bX >= comp.blocks[0].length) continue;
                    if (this.options.tolerantDecoding) {
                        try {
                            this.decodeBlock(comp, bY, bX);
                        } catch (e) {
                            if (e instanceof EndOfScanError) return;
                        }
                    } else {
                        try {
                            this.decodeBlock(comp, bY, bX);
                        } catch (e) {
                            if (e instanceof EndOfScanError) return;
                            throw e;
                        }
                    }
                }
            }
            return;
        }

        outerLoop:
        for (let mcuY = 0; mcuY < mcuHeight; mcuY++) {
            for (let mcuX = 0; mcuX < mcuWidth; mcuX++) {
                for (const component of this.components) {
                    if (this.scanComponentIds.length > 0 && !this.scanComponentIds.includes(component.id)) continue;
                    for (let v = 0; v < component.v; v++) {
                        for (let h = 0; h < component.h; h++) {
                            const blockY = mcuY * component.v + v;
                            const blockX = mcuX * component.h + h;
                            if (blockY < component.blocks.length && blockX < component.blocks[0].length) {
                                if (this.options.tolerantDecoding) {
                                    try {
                                        this.decodeBlock(component, blockY, blockX);
                                    } catch (e) {
                                        if (e instanceof EndOfScanError) break outerLoop;
                                    }
                                } else {
                                    try {
                                        this.decodeBlock(component, blockY, blockX);
                                    } catch (e) {
                                        if (e instanceof EndOfScanError) break outerLoop;
                                        throw e;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private decodeBlock(component: JPEGComponent, blockY: number, blockX: number): void {
        const block = component.blocks[blockY][blockX];

        const isACScan = this.spectralEnd > 0 && this.spectralStart > 0;
        const isACRefinementScan = isACScan && this.successiveHigh > 0;
        if (isACScan && !isACRefinementScan && this.eobRun > 0) {
            this.eobRun--;
            return;
        }

        if (this.spectralStart === 0) {
            const dcTable = this.dcTables[component.dcTable];
            if (!dcTable) throw new Error(`Missing DC table ${component.dcTable}`);
            if (this.successiveHigh === 0) {
                const dcLen = this.decodeHuffman(dcTable);
                const dcDiff = dcLen > 0 ? this.receiveBits(dcLen) : 0;
                component.pred += dcDiff;
                const coeff = component.pred << this.successiveLow;
                if (this.options.extractCoefficients) {
                    block[0] = coeff;
                } else {
                    block[0] = coeff * (this.qTables[component.qTable] as Uint8Array)[0];
                }
            } else {
                const bit = this.readBit();
                if (bit) {
                    const refinement = 1 << this.successiveLow;
                    if (this.options.extractCoefficients) {
                        block[0] += refinement;
                    } else {
                        block[0] += refinement * (this.qTables[component.qTable] as Uint8Array)[0];
                    }
                }
            }
        }

        if (this.spectralEnd > 0) {
            const acTable = this.acTables[component.acTable];
            if (!acTable) throw new Error(`Missing AC table ${component.acTable}`);

            if (this.successiveHigh === 0) {
                let k = this.spectralStart === 0 ? 1 : this.spectralStart;
                while (k <= this.spectralEnd && k < 64) {
                    const rs = this.decodeHuffman(acTable);
                    const r = (rs >> 4) & 0x0f;
                    const s = rs & 0x0f;
                    if (s === 0) {
                        if (r === 15) {
                            k += 16;
                        } else {
                            if (this.isProgressive && r > 0) {
                                const additionalBits = this.receiveUnsignedBits(r);
                                this.eobRun = (1 << r) - 1 + additionalBits;
                            }
                            break;
                        }
                    } else {
                        k += r;
                        if (k > this.spectralEnd) break;
                        const coeff = this.receiveBits(s) << this.successiveLow;
                        if (this.options.extractCoefficients) {
                            block[ZIGZAG[k]] = coeff;
                        } else {
                            block[ZIGZAG[k]] = coeff * (this.qTables[component.qTable] as Uint8Array)[ZIGZAG[k]];
                        }
                        k++;
                    }
                }
            } else {
                const qTable = this.qTables[component.qTable];
                const hadEobRunAtStart = this.eobRun > 0;
                let successiveACState = hadEobRunAtStart ? 4 : 0;
                let successiveACNextValue = 0;
                let runLength = 0;
                let kk = this.spectralStart === 0 ? 1 : this.spectralStart;

                while (kk <= this.spectralEnd && kk < 64) {
                    const z = ZIGZAG[kk];
                    const current = block[z];
                    const direction = current < 0 ? -1 : 1;

                    switch (successiveACState) {
                        case 0: {
                            const rs = this.decodeHuffman(acTable);
                            const realR = (rs >> 4) & 0x0f;
                            const realS = rs & 0x0f;
                            if (realS === 0) {
                                if (realR < 15) {
                                    const additionalBits = this.receiveUnsignedBits(realR);
                                    this.eobRun = (1 << realR) - 1 + additionalBits;
                                    successiveACState = 4;
                                } else {
                                    runLength = 16;
                                    successiveACState = 1;
                                }
                            } else {
                                if (realS !== 1) throw new Error("Invalid AC refinement size");
                                successiveACNextValue = this.receiveBits(realS);
                                runLength = realR;
                                successiveACState = realR ? 2 : 3;
                            }
                            continue;
                        }
                        case 1:
                        case 2:
                            if (current !== 0) {
                                const bit = this.readBit();
                                if (bit) {
                                    const refinement = this.options.extractCoefficients
                                        ? (1 << this.successiveLow)
                                        : (1 << this.successiveLow) * (qTable as Uint8Array)[z];
                                    block[z] += direction * refinement;
                                }
                            } else {
                                runLength--;
                                if (runLength === 0) successiveACState = successiveACState === 2 ? 3 : 0;
                            }
                            break;
                        case 3:
                            if (current !== 0) {
                                const bit = this.readBit();
                                if (bit) {
                                    const refinement = this.options.extractCoefficients
                                        ? (1 << this.successiveLow)
                                        : (1 << this.successiveLow) * (qTable as Uint8Array)[z];
                                    block[z] += direction * refinement;
                                }
                            } else {
                                const newCoeff = successiveACNextValue << this.successiveLow;
                                block[z] = this.options.extractCoefficients ? newCoeff : newCoeff * (qTable as Uint8Array)[z];
                                successiveACState = 0;
                            }
                            break;
                        case 4:
                            if (current !== 0) {
                                const bit = this.readBit();
                                if (bit) {
                                    const refinement = this.options.extractCoefficients
                                        ? (1 << this.successiveLow)
                                        : (1 << this.successiveLow) * (qTable as Uint8Array)[z];
                                    block[z] += direction * refinement;
                                }
                            }
                            break;
                    }
                    kk++;
                }

                if (successiveACState === 4 && hadEobRunAtStart && this.eobRun > 0) {
                    this.eobRun--;
                }
            }
        }

        if (!this.isProgressive && !this.options.extractCoefficients) {
            this.idct(block);
        }
    }

    // ------------------------------------------------------------------
    // Huffman / bit-reading
    // ------------------------------------------------------------------

    private decodeHuffman(table: HuffmanTable): number {
        let code = 0;
        for (let len = 0; len < 16; len++) {
            code = (code << 1) | this.readBit();
            if (table.minCode[len] !== -1 && code <= table.maxCode[len]) {
                const index = table.valPtr[len] + (code - table.minCode[len]);
                if (index >= 0 && index < table.huffVal.length) return table.huffVal[index];
                throw new Error(`Huffman table index out of bounds: ${index}`);
            }
        }
        throw new Error("Invalid Huffman code");
    }

    private readBit(): number {
        if (this.bitCount === 0) {
            if (this.pos >= this.data.length) throw new Error("Unexpected end of JPEG data");
            const byte = this.data[this.pos++];
            if (byte === 0xff) {
                if (this.pos >= this.data.length) throw new Error("Unexpected end of JPEG data after 0xFF");
                const nextByte = this.data[this.pos];
                if (nextByte === 0x00) {
                    this.pos++;
                } else if (nextByte >= 0xd0 && nextByte <= 0xd7) {
                    this.pos++;
                    for (const c of this.components) c.pred = 0;
                    this.eobRun = 0;
                    this.bitBuffer = 0;
                    this.bitCount = 0;
                    return this.readBit();
                } else {
                    this.pos--;
                    throw new EndOfScanError();
                }
            }
            this.bitBuffer = byte;
            this.bitCount = 8;
        }
        this.bitCount--;
        return (this.bitBuffer >> this.bitCount) & 1;
    }

    private receiveBits(n: number): number {
        let value = 0;
        for (let i = 0; i < n; i++) value = (value << 1) | this.readBit();
        if (value < (1 << (n - 1))) value = value - (1 << n) + 1;
        return value;
    }

    private receiveUnsignedBits(n: number): number {
        if (n < 0 || n > 16) throw new Error(`Invalid bit count: ${n}`);
        if (n === 0) return 0;
        let value = 0;
        for (let i = 0; i < n; i++) value = (value << 1) | this.readBit();
        return value;
    }

    // ------------------------------------------------------------------
    // IDCT
    // ------------------------------------------------------------------

    private idct(block: number[] | Int32Array): void {
        const temp = new Float32Array(64);
        for (let i = 0; i < 8; i++) {
            const offset = i * 8;
            for (let j = 0; j < 8; j++) {
                let sum = 0;
                for (let k = 0; k < 8; k++) {
                    const c = k === 0 ? 1 / Math.sqrt(2) : 1;
                    sum += c * block[offset + k] * Math.cos((2 * j + 1) * k * Math.PI / 16);
                }
                temp[offset + j] = sum / 2;
            }
        }
        for (let j = 0; j < 8; j++) {
            for (let i = 0; i < 8; i++) {
                let sum = 0;
                for (let k = 0; k < 8; k++) {
                    const c = k === 0 ? 1 / Math.sqrt(2) : 1;
                    sum += c * temp[k * 8 + j] * Math.cos((2 * i + 1) * k * Math.PI / 16);
                }
                block[i * 8 + j] = Math.max(0, Math.min(255, Math.round(sum / 2 + 128)));
            }
        }
    }

    // ------------------------------------------------------------------
    // Colour conversion / raw output
    // ------------------------------------------------------------------

    private convertToRGB(): Uint8Array {
        const rgba = new Uint8Array(this.width * this.height * 4);

        if (this.options.colorTransform === false) {
            return this.rawComponentsToRGBA(rgba);
        }

        if (this.components.length === 1) {
            const y = this.components[0];
            for (let row = 0; row < this.height; row++) {
                for (let col = 0; col < this.width; col++) {
                    const blockRow = Math.floor(row / 8);
                    const blockCol = Math.floor(col / 8);
                    const bY = row % 8;
                    const bX = col % 8;
                    if (blockRow < y.blocks.length && blockCol < y.blocks[0].length) {
                        const value = y.blocks[blockRow][blockCol][bY * 8 + bX];
                        const offset = (row * this.width + col) * 4;
                        rgba[offset] = value;
                        rgba[offset + 1] = value;
                        rgba[offset + 2] = value;
                        rgba[offset + 3] = 255;
                    }
                }
            }
        } else {
            const [y, cb, cr] = this.components;
            const alphaComp = this.components.length >= 4 ? this.components[3] : undefined;
            const maxH = Math.max(...this.components.map((c) => c.h));
            const maxV = Math.max(...this.components.map((c) => c.v));

            for (let row = 0; row < this.height; row++) {
                for (let col = 0; col < this.width; col++) {
                    const yRow = Math.floor(row * y.v / maxV);
                    const yCol = Math.floor(col * y.h / maxH);
                    const yBlockRow = Math.floor(yRow / 8);
                    const yBlockCol = Math.floor(yCol / 8);
                    let yVal = 0;
                    if (yBlockRow < y.blocks.length && yBlockCol < y.blocks[0].length) {
                        yVal = y.blocks[yBlockRow][yBlockCol][(yRow % 8) * 8 + (yCol % 8)];
                    }

                    const cbRow = Math.floor(row * cb.v / maxV);
                    const cbCol = Math.floor(col * cb.h / maxH);
                    const cbBlockRow = Math.floor(cbRow / 8);
                    const cbBlockCol = Math.floor(cbCol / 8);
                    let cbVal = 0;
                    if (cbBlockRow < cb.blocks.length && cbBlockCol < cb.blocks[0].length) {
                        cbVal = cb.blocks[cbBlockRow][cbBlockCol][(cbRow % 8) * 8 + (cbCol % 8)] - 128;
                    }

                    const crRow = Math.floor(row * cr.v / maxV);
                    const crCol = Math.floor(col * cr.h / maxH);
                    const crBlockRow = Math.floor(crRow / 8);
                    const crBlockCol = Math.floor(crCol / 8);
                    let crVal = 0;
                    if (crBlockRow < cr.blocks.length && crBlockCol < cr.blocks[0].length) {
                        crVal = cr.blocks[crBlockRow][crBlockCol][(crRow % 8) * 8 + (crCol % 8)] - 128;
                    }

                    const r = Math.max(0, Math.min(255, Math.round(yVal + 1.402 * crVal)));
                    const g = Math.max(0, Math.min(255, Math.round(yVal - 0.344136 * cbVal - 0.714136 * crVal)));
                    const b = Math.max(0, Math.min(255, Math.round(yVal + 1.772 * cbVal)));

                    const offset = (row * this.width + col) * 4;
                    rgba[offset] = r;
                    rgba[offset + 1] = g;
                    rgba[offset + 2] = b;

                    if (alphaComp) {
                        const aRow = Math.floor(row * alphaComp.v / maxV);
                        const aCol = Math.floor(col * alphaComp.h / maxH);
                        const aBlockRow = Math.floor(aRow / 8);
                        const aBlockCol = Math.floor(aCol / 8);
                        let aVal = 255;
                        if (aBlockRow < alphaComp.blocks.length && aBlockCol < alphaComp.blocks[0].length) {
                            aVal = alphaComp.blocks[aBlockRow][aBlockCol][(aRow % 8) * 8 + (aCol % 8)];
                        }
                        rgba[offset + 3] = Math.max(0, Math.min(255, aVal));
                    } else {
                        rgba[offset + 3] = 255;
                    }
                }
            }
        }
        return rgba;
    }

    private rawComponentsToRGBA(rgba: Uint8Array): Uint8Array {
        const maxH = Math.max(...this.components.map((c) => c.h));
        const maxV = Math.max(...this.components.map((c) => c.v));
        const numComponents = this.components.length;

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const offset = (row * this.width + col) * 4;
                const limit = Math.min(numComponents, 4);
                for (let i = 0; i < limit; i++) {
                    const comp = this.components[i];
                    const cRow = Math.floor(row * comp.v / maxV);
                    const cCol = Math.floor(col * comp.h / maxH);
                    const blockRow = Math.floor(cRow / 8);
                    const blockCol = Math.floor(cCol / 8);
                    let val = 0;
                    if (blockRow < comp.blocks.length && blockCol < comp.blocks[0].length) {
                        val = comp.blocks[blockRow][blockCol][(cRow % 8) * 8 + (cCol % 8)];
                    }
                    rgba[offset + i] = Math.max(0, Math.min(255, val));
                }
                if (numComponents < 4) rgba[offset + 3] = 255;
            }
        }
        return rgba;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DecodedJPEG {
    width: number;
    height: number;
    /** RGBA pixel data (width * height * 4 bytes). */
    data: Uint8Array;
}

/**
 * Decode a JPEG buffer into RGBA pixel data.
 *
 * @param data        Raw JPEG bytes (must start with FF D8 FF).
 * @param options     Decoder options (colorTransform, tolerantDecoding).
 * @returns           Decoded RGBA image with dimensions.
 */
export function decodeJPEG(
    data: Uint8Array,
    options: { colorTransform?: boolean; tolerantDecoding?: boolean } = {},
): DecodedJPEG {
    if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
        throw new Error("Invalid JPEG signature");
    }

    const width = parseSofDimensions(data);
    validateImageDimensions(width.w, width.h);

    const decoder = new JPEGDecoder(data, {
        tolerantDecoding: options.tolerantDecoding ?? true,
        colorTransform: options.colorTransform,
    });
    const rgba = decoder.decode();

    return { width: decoder.getWidth(), height: decoder.getHeight(), data: rgba };
}

/** Quick SOF scan to extract width/height for validation before full decode. */
function parseSofDimensions(data: Uint8Array): { w: number; h: number } {
    let pos = 2;
    while (pos < data.length - 1) {
        if (data[pos] !== 0xff) {
            pos++;
            continue;
        }
        const marker = data[pos + 1];
        pos += 2;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            const h = (data[pos + 3] << 8) | data[pos + 4];
            const w = (data[pos + 5] << 8) | data[pos + 6];
            return { w, h };
        }
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker >= 0xd0 && marker <= 0xd8) continue;
        if (marker === 0x01) continue;
        const length = (data[pos] << 8) | data[pos + 1];
        pos += length;
    }
    return { w: 0, h: 0 };
}
