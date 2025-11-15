import { NextResponse } from 'next/server';

async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars');
  }
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Spotify token error: ${tokenRes.status} ${body}`);
  }
  const tokenJson = await tokenRes.json();
  return tokenJson.access_token;
}

function normalizePlaylistId(raw) {
  if (!raw) return null;
  if (raw.includes('playlist/')) {
    const match = raw.split('playlist/')[1];
    return match.split(/[?]/)[0];
  }
  if (raw.includes(':')) {
    const parts = raw.split(':');
    return parts[parts.length - 1];
  }
  return raw;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get('id');
  const playlistId = normalizePlaylistId(rawId);
  if (!playlistId) {
    return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();
    const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,external_urls,images,tracks.items(track(id,name,preview_url,artists(name),album(images)))`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!playlistRes.ok) {
      const body = await playlistRes.text();
      return NextResponse.json({ error: `Spotify playlist error: ${playlistRes.status} ${body}` }, { status: playlistRes.status });
    }
    const playlistJson = await playlistRes.json();
    const tracks = (playlistJson?.tracks?.items || [])
      .map((item) => item.track)
      .filter((track) => track && track.preview_url)
      .map((track) => ({
        id: track.id,
        title: track.name,
        artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
        previewUrl: track.preview_url,
        cover: track.album?.images?.[0]?.url || null,
      }));

    return NextResponse.json({
      id: playlistId,
      name: playlistJson?.name || 'Spotify Playlist',
      description: playlistJson?.description || null,
      image: playlistJson?.images?.[0]?.url || null,
      tracks,
    }, { status: 200, headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
