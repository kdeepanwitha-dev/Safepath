import { NextRequest, NextResponse } from 'next/server';
import { runPythonAction } from '@/lib/python-bridge';

export const dynamic = 'force-dynamic';

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (!clean) return true;
  if (
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('127.') ||
    clean.startsWith('::ffff:127.') ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('fc') ||
    clean.startsWith('fd') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  if (clean.startsWith('172.')) {
    const second = Number(clean.split('.')[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const rawIp =
      forwarded?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('cf-connecting-ip')?.trim() ||
      '';

    if (isPrivateOrLocalIp(rawIp)) {
      return NextResponse.json({ detected: false, reason: 'local_network' });
    }

    const res = await fetch(`https://ipwho.is/${encodeURIComponent(rawIp)}`, {
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ detected: false });
    }

    const geo = (await res.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country?: string;
    };

    if (
      !geo?.success ||
      typeof geo.latitude !== 'number' ||
      typeof geo.longitude !== 'number' ||
      !Number.isFinite(geo.latitude) ||
      !Number.isFinite(geo.longitude)
    ) {
      return NextResponse.json({ detected: false });
    }

    const place = runPythonAction('places_reverse', {
      lat: geo.latitude,
      lng: geo.longitude,
    });

    return NextResponse.json({
      detected: true,
      lat: geo.latitude,
      lng: geo.longitude,
      city: geo.city || '',
      region: geo.region || '',
      country: geo.country || '',
      place,
    });
  } catch {
    return NextResponse.json({ detected: false });
  }
}
