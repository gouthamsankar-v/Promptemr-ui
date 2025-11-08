import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body?.input ?? {};

    const external = process.env.PROMPTEMR_API_URL;
    if (external) {
      // Forward request to external API
      const resp = await fetch(external, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // If no external URL provided, return a mock response similar to the sample
    const mock = {
      data: {
        cookie_count: Math.floor(Math.random() * 5),
        current_url: `https://example.com/?email=${encodeURIComponent(input.email || '')}`,
        tokens: {
          access_token: 'mock_access_token_' + Math.random().toString(36).slice(2),
          bearer_token: 'true',
          expires_in: 1800,
          id_token: 'mock_id_token',
          refresh_token: null,
        },
        visits_data: {},
      },
      message: 'Login automation completed successfully (mock)',
      success: true,
    };

    return NextResponse.json(mock);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: String(err?.message ?? err) }, { status: 500 });
  }
}
