import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction('robustness', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Robustness simulation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
