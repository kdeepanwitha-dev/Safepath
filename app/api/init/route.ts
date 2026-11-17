import { NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = runPythonAction('init');
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Python initialization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
