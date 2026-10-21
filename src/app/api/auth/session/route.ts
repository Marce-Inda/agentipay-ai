import { connection, NextRequest, NextResponse } from 'next/server';
import { getSession, publicUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  await connection();

  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: publicUser(session.user),
        expiresAt: session.expiresAt,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[AgenticPay AI Session Error]:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
