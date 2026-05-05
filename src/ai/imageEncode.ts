// AI Systems & Integration. Encode raw RGBA Uint8Array buffers (the
// shape returned by the WebGL2 pipeline's `readPixels`) to base64 PNG
// strings for the Anthropic vision API.
//
// Browser-only. The eval harness under src/ai/eval/ runs in node and
// will need its own encoder (see AI_SYSTEMS.md task 2); add it there
// when wiring the harness, do not pollute this module with a node
// branch that tsconfig.app.json cannot type-check.

export async function rgbaToPngBase64(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<string> {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(
      `rgbaToPngBase64: buffer length ${rgba.length} does not match ${width}x${height}x4 (${expected})`,
    );
  }

  const blob = await renderToPngBlob(rgba, width, height);
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

async function renderToPngBlob(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<Blob> {
  // Allocate a fresh ArrayBuffer-backed view so the resulting
  // Uint8ClampedArray<ArrayBuffer> satisfies ImageData's constructor
  // type. Copying from the input is required anyway because the
  // source buffer may be SharedArrayBuffer-backed under TS 5.7.
  const clamped = new Uint8ClampedArray(new ArrayBuffer(rgba.length));
  clamped.set(rgba);
  const imageData = new ImageData(clamped, width, height);

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('rgbaToPngBase64: OffscreenCanvas 2d context unavailable');
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  // Fallback for browsers without OffscreenCanvas. Tests using jsdom
  // hit this path; jsdom's canvas backend may need a polyfill.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('rgbaToPngBase64: HTMLCanvasElement 2d context unavailable');
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    );
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // 32 KiB chunks keep us well under the spread-arg limit while staying
  // fast for our 512x512 fixed render size.
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
