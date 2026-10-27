import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cleanImage, IMAGE_LIMITS, ImageRejected, sniffFormat } from "../src/image-pipeline.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../../templates/e2e/fixture/assets/${name}`, import.meta.url));

/** A detailed (sharp) test photo: random noise, so it is never "blurry". */
async function noisePhoto(width: number, height: number, format: "jpeg" | "png" | "webp" = "jpeg") {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919) % 251;
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    [format]()
    .toBuffer();
}

describe("format sniffing", () => {
  it("reads the format from the bytes", async () => {
    expect(sniffFormat(await noisePhoto(10, 10, "jpeg"))).toBe("jpeg");
    expect(sniffFormat(await noisePhoto(10, 10, "png"))).toBe("png");
    expect(sniffFormat(await noisePhoto(10, 10, "webp"))).toBe("webp");
  });

  it("refuses SVG, GIF, HTML and empty files", () => {
    expect(sniffFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffFormat(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffFormat(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe("cleaning", () => {
  it("re-encodes as WebP, within 2000 px, and keeps a big photo strong", async () => {
    const result = await cleanImage(await noisePhoto(3000, 2000));
    expect(sniffFormat(result.data)).toBe("webp");
    expect(Math.max(result.width, result.height)).toBe(IMAGE_LIMITS.maxSide);
    expect(result.strong).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("drops EXIF and GPS", async () => {
    const withExif = await sharp(await noisePhoto(800, 600))
      .withExif({ IFD0: { Make: "Celular do Zé", Copyright: "GPS -22.25,-45.70" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const result = await cleanImage(withExif);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(result.data.includes(Buffer.from("Celular do Zé"))).toBe(false);
  });

  it("turns photos upright from their EXIF orientation", async () => {
    const sideways = await sharp(await noisePhoto(400, 300))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await cleanImage(sideways);
    expect([result.width, result.height]).toEqual([300, 400]);
  });

  it("neutralizes a polyglot: script hidden after the image data does not survive", async () => {
    const polyglot = Buffer.concat([
      await noisePhoto(200, 200),
      Buffer.from("<script>alert(document.cookie)</script><svg onload=alert(1)>"),
    ]);
    const result = await cleanImage(polyglot);
    expect(result.data.includes(Buffer.from("<script>"))).toBe(false);
    expect(result.data.includes(Buffer.from("onload"))).toBe(false);
  });

  it("warns about small and blurry photos", async () => {
    const small = await cleanImage(await noisePhoto(600, 400));
    expect(small.strong).toBe(false);
    expect(small.warnings.join(" ")).toMatch(/pequena/);
    const blurry = await cleanImage(fixture("hero.jpg"));
    expect(blurry.warnings.join(" ")).toMatch(/desfocada/);
  });
});

describe("refusals", () => {
  const refused = (input: Buffer) =>
    expect(cleanImage(input)).rejects.toBeInstanceOf(ImageRejected);

  it("refuses SVG sent as an image", async () => {
    await refused(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'));
  });

  it("refuses an HTML file renamed to .jpg", async () => {
    await refused(Buffer.from("<!doctype html><script>alert(1)</script>"));
  });

  it("refuses a file whose header lies about its content", async () => {
    await refused(
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("not really a jpeg")]),
    );
  });

  it("refuses files over 10 MB and empty files", async () => {
    await refused(Buffer.alloc(IMAGE_LIMITS.maxBytes + 1, 0xff));
    await refused(Buffer.alloc(0));
  });

  it("refuses images with too many pixels (decompression bombs)", async () => {
    const bomb = await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: "#ffffff" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.byteLength).toBeLessThan(IMAGE_LIMITS.maxBytes);
    await refused(bomb);
  });

  it("gives the client a message in Portuguese", async () => {
    await expect(cleanImage(Buffer.from("<svg/>"))).rejects.toThrow(/foto em JPG, PNG ou WebP/);
  });
});
