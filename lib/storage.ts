import path from "node:path";

export function privateStorageDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "storage/private");
}

export function fileInsideStorage(storedName: string) {
  const root = path.resolve(privateStorageDir());
  const target = path.resolve(root, storedName);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

export function sniffDocument(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("utf8") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}
