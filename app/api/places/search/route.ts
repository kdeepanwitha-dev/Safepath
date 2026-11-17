import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const payload = {
      q: sp.get('q') || '',
      lat: sp.get('lat'),
      lng: sp.get('lng'),
      limit: sp.get('limit') ? Number(sp.get('limit')) : 18,
      category: sp.get('category') || '',
    };
    const data = runPythonAction('places_search', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to search places';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction('places_search', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to search places';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
