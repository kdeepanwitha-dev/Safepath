import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction<{ text: string }>('report_text', payload);
    const src = String(payload?.source_place?.name || payload?.source || 'origin')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'origin';
    const dst = String(payload?.dest_place?.name || payload?.dest || 'destination')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'destination';

    return new NextResponse(data.text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="safepath_safety_report_${src}_to_${dst}.txt"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report generation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
