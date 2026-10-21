import { NextRequest, NextResponse } from 'next/server';
import { assertTrustedOrigin, destroySession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  if (!assertTrustedOrigin(request)) {
    return NextResponse.json(
      { error: 'Untrusted request origin.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    await destroySession(request);
  } catch (error) {
    console.error('[AgenticPay AI Logout Error]:', error);
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
