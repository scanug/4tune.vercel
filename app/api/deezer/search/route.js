import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'playlist';
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  // Deezer search endpoint supports playlist search via /search/playlist?q=...
  const endpoint = type === 'playlist' ? 'playlist' : type;
  const url = `https://api.deezer.com/search/${endpoint}?limit=10&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Deezer search error: ${res.status} ${txt}` }, { status: res.status });
    }
    const json = await res.json();
    const data = (json?.data || []).map((item) => ({
      id: item.id,
      title: item.title || item.name || '',
      creator: item.user?.name || item.artist?.name || null,
      trackCount: item.nb_tracks || null,
      picture: item.picture_medium || item.picture_small || null,
      provider: 'deezer',
    }));
    return NextResponse.json({ data }, { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
