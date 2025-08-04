import { assertEquals } from "@std/assert";
import { uint8ArrayToStream } from "./streams.ts";

Deno.test("uint8ArrayToStream - basic functionality", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = uint8ArrayToStream(data);

    const reader = stream.getReader();
    const result = await reader.read();

    assertEquals(result.done, false);
    assertEquals(result.value, data);

    const finalResult = await reader.read();
    assertEquals(finalResult.done, true);
});

Deno.test("uint8ArrayToStream - empty array", async () => {
    const data = new Uint8Array(0);
    const stream = uint8ArrayToStream(data);

    const reader = stream.getReader();
    const result = await reader.read();

    assertEquals(result.done, false);
    assertEquals(result.value?.length, 0);

    const finalResult = await reader.read();
    assertEquals(finalResult.done, true);
});

Deno.test("uint8ArrayToStream - large array", async () => {
    const data = new Uint8Array(1000);
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
    }

    const stream = uint8ArrayToStream(data);

    const reader = stream.getReader();
    const result = await reader.read();

    assertEquals(result.done, false);
    assertEquals(result.value?.length, 1000);
    assertEquals(result.value?.[0], 0);
    assertEquals(result.value?.[999], 231); // 999 % 256

    const finalResult = await reader.read();
    assertEquals(finalResult.done, true);
});
