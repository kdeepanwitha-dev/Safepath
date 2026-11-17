import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const data = runPythonAction('reports_load', { filename });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Saved report not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const data = runPythonAction('reports_delete', { filename });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete report';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
