import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const payload = {
      lat: sp.get('lat') ? Number(sp.get('lat')) : 12.9716,
      lng: sp.get('lng') ? Number(sp.get('lng')) : 77.5946,
    };
    const data = runPythonAction('places_reverse', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reverse geocode coordinates';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = runPythonAction('places_reverse', payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reverse geocode coordinates';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
