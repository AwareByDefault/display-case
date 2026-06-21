// pixelmatch v6 ships no bundled type declarations; this is the minimal surface
// Display Case uses.
declare module 'pixelmatch' {
  export default function pixelmatch(
    img1: Uint8Array | Uint8ClampedArray,
    img2: Uint8Array | Uint8ClampedArray,
    output: Uint8Array | Uint8ClampedArray | null,
    width: number,
    height: number,
    options?: { threshold?: number; includeAA?: boolean },
  ): number
}
