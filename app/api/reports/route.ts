import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = runPythonAction('reports_list');
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list reports';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction('reports_save', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save report';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
