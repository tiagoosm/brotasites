import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CARD_VIEWPORTS, playwrightScreenshotter } from "../../src/index.js";

describe("direction card screenshots", () => {
  it("photographs the first screen at phone and desktop widths, blocking outside requests", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brotasites-shot-"));
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><body style="margin:0;background:#fef3c7"><h1>Padaria do Zé</h1><img src="https://example.com/x.png" alt=""></body></html>',
    );
    const shoot = playwrightScreenshotter();
    try {
      const shots = await shoot(dir);
      expect(shots.map((shot) => shot.width)).toEqual(
        CARD_VIEWPORTS.map((viewport) => viewport.width),
      );
      for (const shot of shots) {
        expect(shot.png.subarray(1, 4).toString()).toBe("PNG");
        // PNG width is stored at bytes 16-19.
        expect(shot.png.readUInt32BE(16)).toBe(shot.width);
      }
    } finally {
      await shoot.close();
    }
  });
});
