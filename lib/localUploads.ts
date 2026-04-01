import { mkdir, writeFile } from "fs/promises";
import path from "path";

const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

export async function savePublicUpload(params: {
  folder: string;
  entityId: string;
  file: File;
}) {
  const { folder, entityId, file } = params;
  const ext = sanitizeFileName(file.name).split(".").pop() || "bin";
  const fileName = `${Date.now()}.${ext}`;
  const dir = path.join(PUBLIC_UPLOADS_DIR, folder, entityId);
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, bytes);
  return `/uploads/${folder}/${entityId}/${fileName}`;
}
