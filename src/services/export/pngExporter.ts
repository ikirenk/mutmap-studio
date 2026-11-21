const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// Precomputed CRC-32 table for valid PNG chunk checksums
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
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

/**
 * Injects or replaces the PNG `pHYs` chunk so the exported raster image carries exact
 * DPI metadata (300 DPI -> 11811 px/m, 600 DPI -> 23622 px/m) in print editors.
 */
export function injectPngDpi(pngBytes: Uint8Array, dpi: number): Uint8Array {
  if (pngBytes.length < 33) {
    throw new Error('Geçersiz PNG verisi.');
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (pngBytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('PNG dosya imzası doğrulanamadı.');
    }
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254);

  // Construct pHYs chunk: length (4) + type "pHYs" (4) + data (9) + CRC (4) = 21 bytes
  const physChunk = new Uint8Array(21);
  writeUint32BE(physChunk, 0, 9);
  physChunk[4] = 0x70; // 'p'
  physChunk[5] = 0x48; // 'H'
  physChunk[6] = 0x59; // 'Y'
  physChunk[7] = 0x73; // 's'
  writeUint32BE(physChunk, 8, pixelsPerMeter); // X pixels per unit
  writeUint32BE(physChunk, 12, pixelsPerMeter); // Y pixels per unit
  physChunk[16] = 1; // unit specifier: 1 = meter
  const crc = crc32(physChunk.subarray(4, 17));
  writeUint32BE(physChunk, 17, crc);

  // Strip any existing pHYs chunks and insert our new pHYs right after IHDR
  const chunks: Uint8Array[] = [pngBytes.subarray(0, 8)];
  let offset = 8;
  let inserted = false;

  while (offset + 12 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const totalChunkSize = 12 + length;
    if (offset + totalChunkSize > pngBytes.length) break;

    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    );

    if (type !== 'pHYs') {
      chunks.push(pngBytes.subarray(offset, offset + totalChunkSize));
      if (type === 'IHDR' && !inserted) {
        chunks.push(physChunk);
        inserted = true;
      }
    }
    offset += totalChunkSize;
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const c of chunks) {
    out.set(c, cursor);
    cursor += c.length;
  }
  return out;
}

/**
 * Renders the vector SVG onto a high-resolution offscreen canvas scaled by (dpi / 96)
 * and injects physical pHYs DPI headers into the resulting PNG byte array.
 */
export async function exportSvgToPngBytes(options: {
  svgMarkup: string;
  widthPx: number;
  heightPx: number;
  dpi: 300 | 600;
  backgroundColor: string;
  transparentBackground?: boolean;
}): Promise<Uint8Array> {
  const scale = options.dpi / 96;
  const targetW = Math.round(options.widthPx * scale);
  const targetH = Math.round(options.heightPx * scale);

  const svgBlob = new Blob([options.svgMarkup], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('SVG rasterizasyonu sırasında görüntü yüklenemedi.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D Canvas bağlamı oluşturulamadı.');
    }

    if (!options.transparentBackground && options.backgroundColor !== 'transparent') {
      ctx.fillStyle = options.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, options.widthPx, options.heightPx);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG kodlaması başarısız oldu.'));
        },
        'image/png',
        1.0,
      );
    });

    const rawBytes = new Uint8Array(await pngBlob.arrayBuffer());
    return injectPngDpi(rawBytes, options.dpi);
  } finally {
    URL.revokeObjectURL(url);
  }
}
