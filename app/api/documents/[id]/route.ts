import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { fileInsideStorage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "admissions.manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const target = fileInsideStorage(document.storedName);
  if (!target) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const file = await readFile(target);
  return new NextResponse(file, {
    headers: {
      "Content-Type": document.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${document.filename.replace(/"/g, "")}"`,
    },
  });
}
