import { describeHeader } from "../mod.ts";

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
