import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { privateStorageDir } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "admissions.manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const file = await readFile(path.join(/*turbopackIgnore: true*/ privateStorageDir(), document.storedName));
  return new NextResponse(file, {
    headers: {
      "Content-Type": document.mime,
      "Content-Disposition": `attachment; filename="${document.filename.replace(/"/g, "")}"`,
    },
  });
}
