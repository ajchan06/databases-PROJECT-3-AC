# StreamIQ — Redis Extension (Project 3)

### CS3200 Project 3: Design & Implement a Key-Value In-Memory Database

StreamIQ is a music streaming platform. This project extends the MongoDB database from Project 2 with a **Redis in-memory key-value store** for real-time song play tracking and leaderboard functionality.

> **AI Usage:** AI tools (Claude by Anthropic) were used to assist with generating boilerplate code, structuring Redis commands documentation, and drafting README content.

---

## Video Demonstration

🎥 _[Add your video link here after recording]_

---

## Redis Features Added

| Feature | Redis Structure | Key Pattern |
|---------|----------------|-------------|
| Global song leaderboard | Sorted Set | `topSongs` |
| Song metadata cache | Hash | `song:{songID}` |

### Why These Structures?

**Sorted Set (`topSongs`)** — members are song IDs, scores are play counts. Supports O(log N) increments and O(log N + M) ranked reads. Perfect for a real-time leaderboard.

**Hash (`song:{id}`)** — stores `title`, `artistName`, `albumTitle`, `duration` fields per song. Allows leaderboard rendering without querying MongoDB on every request.

---

## Repository Structure

```
databases-Project-3-AC/
├── streamiq-redis-app/       # Node + Express + Redis application
│   ├── app.js                # Main server — all routes
│   ├── package.json
│   └── views/
│       ├── index.ejs         # Leaderboard home page
│       └── song.ejs          # Song detail / edit page
├── docs/
│   └── P3_Requirements.docx  # Requirements + Redis data structures + commands
└── README.md
```

---

## Part 1 — Requirements

See `docs/P3_Requirements.docx` for the full requirements document and UML (reused from Project 2).

**Redis addition:** StreamIQ uses Redis to power a real-time "Top Songs" leaderboard. Every play event increments a song's score atomically in a Sorted Set. Song metadata is cached in Redis Hashes to avoid MongoDB reads on every leaderboard render.

---

## Part 2 — Redis Data Structures

### Sorted Set: `topSongs`

```
Key: "topSongs"
Members: song IDs (strings, e.g. "1001")
Scores:  total play count (integer)
```

**Example state:**
```
"1001" → 14 plays   (Midnight Rain — Aurora Wave)
"1008" → 11 plays   (Low Frequency — BeatDrop)
"1003" →  9 plays   (Electric Pulse — Aurora Wave)
```

### Hash: `song:{songID}`

```
Key:    "song:1001"
Fields: title, artistName, albumTitle, duration
```

**Example:**
```
song:1001
  title       → "Midnight Rain"
  artistName  → "Aurora Wave"
  albumTitle  → "Dreamscape"
  duration    → "234"
```

---

## Part 3 — Redis Commands (Full CRUD)

### Initialize
```bash
FLUSHALL
HSET song:1001 title "Midnight Rain" artistName "Aurora Wave" albumTitle "Dreamscape" duration "234"
ZADD topSongs 14 "1001" 11 "1008" 9 "1003"
```

### Create
```bash
# Add a new song to the leaderboard
ZADD topSongs 0 "1021"
HSET song:1021 title "Moonrise" artistName "Luna Park" albumTitle "Starlight" duration "232"
```

### Read
```bash
# Top 10 songs (highest plays first) with scores
ZREVRANGE topSongs 0 9 WITHSCORES

# Play count for one song
ZSCORE topSongs "1001"

# Rank of a song (0 = #1)
ZREVRANK topSongs "1001"

# All metadata for a song
HGETALL song:1001

# One metadata field
HGET song:1001 title
```

### Update
```bash
# Log a play (increment score by 1)
ZINCRBY topSongs 1 "1001"

# Update cached metadata
HSET song:1001 artistName "Aurora Wave"
```

### Delete
```bash
# Remove song from leaderboard
ZREM topSongs "1001"

# Delete metadata cache
DEL song:1001

# Wipe everything
FLUSHALL
```

---

## Part 4 — Node + Express Application

### Prerequisites

- Node.js v18+
- Redis server running on `localhost:6379`

### Setup & Run

```bash
# Start Redis (if not already running)
redis-server

# Install dependencies
cd streamiq-redis-app
npm install

# Start the app
npm start
```

Open **http://localhost:3000**

### Features

| Route | Method | Operation | Redis Command |
|-------|--------|-----------|---------------|
| `/` | GET | View leaderboard | `ZREVRANGE topSongs 0 9 WITHSCORES` + `HGETALL song:{id}` |
| `/songs` | POST | Add song | `ZADD topSongs` + `HSET song:{id}` |
| `/songs/:id` | GET | View/edit song | `HGETALL song:{id}` + `ZSCORE` + `ZREVRANK` |
| `/songs/:id/edit` | POST | Update metadata | `HSET song:{id}` |
| `/play/:id` | POST | Log a play | `ZINCRBY topSongs 1 "{id}"` |
| `/songs/:id/delete` | POST | Remove song | `ZREM topSongs` + `DEL song:{id}` |
| `/reset` | POST | Flush + reseed | `FLUSHALL` |

### Interface

- **Leaderboard** — ranked table with play bar visualization
- **▶ Play button** — logs a play for any song (ZINCRBY)
- **Edit** — update song metadata (HSET), view rank + play count
- **Delete** — removes from sorted set and deletes hash
- **Quick Play dropdown** — log plays for any song in the database
- **FLUSHALL + Reseed** — resets Redis and reloads Project 2 song data

---

## About the Project Stack

| Layer | Technology |
|-------|-----------|
| Web server | Node.js + Express |
| Templating | EJS |
| In-memory store | Redis (ioredis / node-redis v4) |
| Document database | MongoDB (Project 2, not extended in P3) |
