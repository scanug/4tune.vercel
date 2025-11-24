import { NextResponse } from 'next/server';

function normalizePlaylistId(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const parts = trimmed.split(/[/?#]/).filter(Boolean);
  const last = parts[parts.length - 1];
  const num = Number(last);
  return Number.isFinite(num) ? num : trimmed;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get('id');
  const playlistId = normalizePlaylistId(rawId);
  if (!playlistId) {
    return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.deezer.com/playlist/${playlistId}`, { cache: 'no-store' });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Deezer playlist error: ${res.status} ${txt}` }, { status: res.status });
    }
    const json = await res.json();
    const tracks = (json?.tracks?.data || [])
      .filter((t) => t && t.preview)
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist?.name || 'Unknown Artist',
        previewUrl: t.preview,
        cover: t.album?.cover_medium || t.album?.cover || null,
        provider: 'deezer',
      }));

    return NextResponse.json({
      id: playlistId,
      name: json?.title || 'Deezer Playlist',
      description: json?.description || null,
      image: json?.picture_medium || json?.picture_big || null,
      tracks,
      provider: 'deezer',
    }, { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
