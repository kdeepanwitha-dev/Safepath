import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const data = runPythonAction('sos_history', {
      limit: limitParam ? Number(limitParam) : 25,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load SOS dispatch history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction('sos_update', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update SOS dispatch record';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
