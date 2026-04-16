// StreamIQ Redis App — Project 3
// Node + Express + Redis
// Leaderboard feature: Sorted Set (topSongs) + Hash (song:{id})

const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// ── Redis client ──────────────────────────────────────────────
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('Redis error:', err));

(async () => {
  await redis.connect();
  console.log('Connected to Redis');

  // Seed data on startup if leaderboard is empty
  const exists = await redis.exists('topSongs');
  if (!exists) {
    await seedData();
    console.log('Seeded Redis with sample data');
  }
})();

// ── Seed data matching Project 2 songs ───────────────────────
async function seedData() {
  // Song metadata (Hash)
  const songs = [
    { id: '1001', title: 'Midnight Rain',    artist: 'Aurora Wave',  album: 'Dreamscape',      duration: '234' },
    { id: '1002', title: 'Golden Hour',      artist: 'Aurora Wave',  album: 'Dreamscape',      duration: '198' },
    { id: '1003', title: 'Electric Pulse',   artist: 'Aurora Wave',  album: 'Dreamscape',      duration: '267' },
    { id: '1004', title: 'Vapor Trail',      artist: 'Aurora Wave',  album: 'Dreamscape',      duration: '185' },
    { id: '1005', title: 'Still Waters',     artist: 'Aurora Wave',  album: 'Dreamscape',      duration: '312' },
    { id: '1006', title: 'Echoes',           artist: 'Aurora Wave',  album: 'Echoes',          duration: '210' },
    { id: '1007', title: 'Adrenaline',       artist: 'BeatDrop',     album: 'Neon Nights',     duration: '195' },
    { id: '1008', title: 'Low Frequency',    artist: 'BeatDrop',     album: 'Neon Nights',     duration: '248' },
    { id: '1009', title: 'Bassline',         artist: 'BeatDrop',     album: 'Neon Nights',     duration: '178' },
    { id: '1010', title: 'Wavelength',       artist: 'BeatDrop',     album: 'Wavelength',      duration: '220' },
    { id: '1012', title: 'Refracted Light',  artist: 'DJ Prism',     album: 'Prism Refractions', duration: '302' },
    { id: '1013', title: 'Deep End',         artist: 'DJ Prism',     album: 'Prism Refractions', duration: '275' },
    { id: '1016', title: 'City Lights',      artist: 'Max Sterling', album: 'Concrete Jungle', duration: '215' },
    { id: '1017', title: 'Concrete Jungle',  artist: 'Max Sterling', album: 'Concrete Jungle', duration: '253' },
    { id: '1019', title: 'Starlight',        artist: 'Luna Park',    album: 'Starlight',       duration: '204' },
    { id: '1020', title: 'Cherry Blossom',   artist: 'Luna Park',    album: 'Starlight',       duration: '178' },
  ];

  for (const s of songs) {
    await redis.hSet(`song:${s.id}`, {
      title: s.title,
      artistName: s.artist,
      albumTitle: s.album,
      duration: s.duration
    });
  }

  // Leaderboard scores (Sorted Set)
  await redis.zAdd('topSongs', [
    { score: 14, value: '1001' },
    { score: 11, value: '1008' },
    { score: 9,  value: '1003' },
    { score: 8,  value: '1007' },
    { score: 7,  value: '1013' },
    { score: 6,  value: '1019' },
    { score: 5,  value: '1002' },
    { score: 4,  value: '1016' },
    { score: 3,  value: '1012' },
    { score: 2,  value: '1020' },
  ]);
}

// ── Routes ────────────────────────────────────────────────────

// GET / — Home: leaderboard
app.get('/', async (req, res) => {
  try {
    // ZREVRANGE: top 10 songs highest score first
    const entries = await redis.zRangeWithScores('topSongs', 0, 9, { REV: true });

    // Enrich each entry with song metadata from Hash
    const leaderboard = await Promise.all(entries.map(async ({ value: songId, score }, index) => {
      const meta = await redis.hGetAll(`song:${songId}`);
      return {
        rank: index + 1,
        songId,
        plays: Math.round(score),
        title: meta.title || `Song ${songId}`,
        artistName: meta.artistName || 'Unknown',
        albumTitle: meta.albumTitle || 'Unknown',
        duration: meta.duration || '0'
      };
    }));

    // All songs for the "add song" form dropdown
    const allKeys = await redis.keys('song:*');
    const allSongs = await Promise.all(allKeys.map(async (key) => {
      const id = key.replace('song:', '');
      const meta = await redis.hGetAll(key);
      return { id, ...meta };
    }));
    allSongs.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    res.render('index', { leaderboard, allSongs, message: req.query.msg || null });
  } catch (err) {
    console.error(err);
    res.status(500).send('Redis error: ' + err.message);
  }
});

// POST /play/:songId — Log a play (ZINCRBY) [UPDATE]
app.post('/play/:songId', async (req, res) => {
  const { songId } = req.params;
  try {
    const newScore = await redis.zIncrBy('topSongs', 1, songId);
    res.redirect(`/?msg=Logged play for song ${songId} (total: ${Math.round(newScore)})`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// POST /songs — Add a song to leaderboard [CREATE]
app.post('/songs', async (req, res) => {
  const { songId, title, artistName, albumTitle, duration, initialPlays } = req.body;
  if (!songId || !title || !artistName) {
    return res.redirect('/?msg=Error: songId, title, and artistName are required');
  }
  try {
    // HSET: store metadata
    await redis.hSet(`song:${songId}`, { title, artistName, albumTitle: albumTitle || '', duration: duration || '0' });
    // ZADD: add to leaderboard
    await redis.zAdd('topSongs', [{ score: parseInt(initialPlays) || 0, value: songId }]);
    res.redirect(`/?msg=Added "${title}" to leaderboard`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// GET /songs/:songId — Get song detail (READ single)
app.get('/songs/:songId', async (req, res) => {
  const { songId } = req.params;
  try {
    const meta = await redis.hGetAll(`song:${songId}`);
    const score = await redis.zScore('topSongs', songId);
    const rank = await redis.zRevRank('topSongs', songId);
    res.render('song', {
      songId,
      meta,
      plays: score !== null ? Math.round(score) : 0,
      rank: rank !== null ? rank + 1 : 'Not ranked'
    });
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// POST /songs/:songId/edit — Update song metadata [UPDATE]
app.post('/songs/:songId/edit', async (req, res) => {
  const { songId } = req.params;
  const { title, artistName, albumTitle, duration } = req.body;
  try {
    await redis.hSet(`song:${songId}`, { title, artistName, albumTitle: albumTitle || '', duration: duration || '0' });
    res.redirect(`/?msg=Updated song ${songId}`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// POST /songs/:songId/delete — Remove song from leaderboard [DELETE]
app.post('/songs/:songId/delete', async (req, res) => {
  const { songId } = req.params;
  try {
    await redis.zRem('topSongs', songId);   // Remove from sorted set
    await redis.del(`song:${songId}`);       // Remove metadata hash
    res.redirect(`/?msg=Deleted song ${songId} from leaderboard`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// POST /reset — Reseed data
app.post('/reset', async (req, res) => {
  try {
    await redis.flushAll();
    await seedData();
    res.redirect('/?msg=Database reset and reseeded');
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`StreamIQ Redis App running at http://localhost:${PORT}`);
});
