import path from "node:path";

export function privateStorageDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), process.env.STORAGE_DIR || "storage/private");
}
