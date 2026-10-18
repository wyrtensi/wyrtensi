import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const theme of ['dark', 'light']) {
  test(`swirl-${theme}.webp is an opaque 780 square WebP within budget`, async () => {
    const b = await readFile(new URL(`../assets/swirl-${theme}.webp`, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.toString('ascii', 8, 12), 'WEBP');
    assert.equal(b.toString('ascii', 12, 16), 'VP8 ', 'simple lossy format, no alpha');
    assert.deepEqual([b[23], b[24], b[25]], [0x9d, 0x01, 0x2a], 'VP8 start code');
    const w = b.readUInt16LE(26) & 0x3fff;
    const h = b.readUInt16LE(28) & 0x3fff;
    assert.deepEqual([w, h], [780, 780]);
    assert.ok(b.length <= 150000, `size ${b.length}`);
  });
}
