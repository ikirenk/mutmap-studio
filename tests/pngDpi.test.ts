import { describe, expect, it } from 'vitest';
import { injectPngDpi } from '../src/services/export/pngExporter';

function makeMinimalPng(): Uint8Array {
  // Valid PNG signature + minimal 13-byte IHDR + 0-byte IEND
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    // IHDR length = 13
    0, 0, 0, 13,
    73, 72, 68, 82, // "IHDR"
    0, 0, 0, 1, // width 1
    0, 0, 0, 1, // height 1
    8, 2, 0, 0, 0, // bit depth, color type, etc.
    0x90, 0x77, 0x53, 0xde, // CRC
    // IEND length = 0
    0, 0, 0, 0,
    73, 69, 78, 68, // "IEND"
    0xae, 0x42, 0x60, 0x82,
  ]);
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

describe('injectPngDpi', () => {
  it('encodes 300 DPI and 600 DPI pHYs chunks right after IHDR', () => {
    const base = makeMinimalPng();

    const png300 = injectPngDpi(base, 300);
    // pHYs starts immediately after 8-byte sig + 25-byte IHDR = offset 33
    const type300 = String.fromCharCode(
      png300[37],
      png300[38],
      png300[39],
      png300[40],
    );
    expect(type300).toBe('pHYs');
    expect(readUint32BE(png300, 41)).toBe(11811); // round(300 / 0.0254)
    expect(readUint32BE(png300, 45)).toBe(11811);
    expect(png300[49]).toBe(1); // meters

    const png600 = injectPngDpi(base, 600);
    expect(readUint32BE(png600, 41)).toBe(23622); // round(600 / 0.0254)
    expect(readUint32BE(png600, 45)).toBe(23622);
  });
});
