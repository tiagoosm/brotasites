import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

// The site's static export (docs/product.md: the site belongs to the client): every file of a
// build in one .zip, deflated. A minimal ZIP writer (no dependency): local headers, data,
// central directory and end record, UTF-8 names.

interface Entry {
  name: Buffer;
  crc: number;
  size: number;
  compressed: Buffer;
  offset: number;
}

const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fixed date: the same build, the same zip

export async function zipDir(dir: string): Promise<Buffer> {
  const files = (await readdir(dir, { withFileTypes: true, recursive: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  const chunks: Buffer[] = [];
  const entries: Entry[] = [];
  let offset = 0;
  for (const file of files) {
    const data = await readFile(file);
    const name = Buffer.from(relative(dir, file).split(sep).join("/"), "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const entry = { name, crc: crc32(data), size: data.length, compressed, offset };
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(entry.crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
    offset += header.length + name.length + compressed.length;
    entries.push(entry);
  }
  const directoryStart = offset;
  for (const entry of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.compressed.length, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt32LE(entry.offset, 42);
    chunks.push(header, entry.name);
    offset += header.length + entry.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - directoryStart, 12);
  end.writeUInt32LE(directoryStart, 16);
  chunks.push(end);
  return Buffer.concat(chunks);
}
