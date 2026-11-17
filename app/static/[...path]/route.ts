import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const staticRoot = path.resolve(process.cwd(), 'static');
  const resolved = path.resolve(staticRoot, ...segments);

  if (!resolved.startsWith(staticRoot + path.sep) || !fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'Static asset not found' }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const content = fs.readFileSync(resolved, 'utf-8');

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}
