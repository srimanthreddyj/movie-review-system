# 🎬 CineTrack — Requirements Document v2.0
## Verified & Updated — Ready for Implementation

---

## 1. Project Summary

**App Name:** CineTrack  
**Type:** Personal full-stack movie tracking web application  
**Stack:** React (Vite) + Node.js/Express + MongoDB Atlas M0 (Free)  
**Deployment:** Vercel (frontend) + Render.com (backend)

---

## 2. Architecture Decisions Confirmed

| Decision | Choice | Notes |
|---|---|---|
| Auth | JWT login + Admin panel | Users login; admin has elevated privileges |
| Movie data source | Hybrid API + Manual | See Section 3 for full strategy |
| Languages | All languages | Bollywood, Tollywood, Hollywood, Kollywood, etc. |
| Movie explanations | AI-generated (Claude API) | On-demand via button |
| Movie clips | Manual URL entry by user | YouTube or any link |
| Data stored in DB | User data + Favourites only | Movie/Cast data fetched from API; enrichment stored |
| Comments | Private per-user, per-entity | Only the owner can see their own comments |

---

## 3. Movie Data Strategy — The India Problem & Solution

### The Problem
TMDB is blocked by major Indian ISPs (Jio, etc.). We need a reliable, India-accessible, free movie data source that covers Bollywood, Tollywood, and Hollywood uniformly — including cast data.

### Brainstormed Options

| Option | Coverage | India Access | Cast Data | Free |
|---|---|---|---|---|
| TMDB API | Excellent (all languages) | ❌ Blocked by some ISPs | ✅ Full | ✅ |
| OMDb API | Good (Hollywood-heavy) | ✅ Accessible | ⚠️ Limited | ✅ 1000/day |
| Cinemalytics | Bollywood-focused | ✅ Indian company | ✅ Good | ✅ |
| Wikidata SPARQL | All languages | ✅ Always accessible | ✅ Moderate | ✅ Unlimited |
| Wikipedia API | All languages | ✅ Always accessible | ⚠️ Unstructured | ✅ Unlimited |

### ✅ Recommended Hybrid Strategy

**Backend acts as a proxy + aggregator.** The user types a movie title in the Admin panel, the backend tries sources in this order:

```
1. TMDB (via our backend server — Render is NOT in India, so it CAN reach TMDB freely)
   → Gets: full metadata, cast, posters, multilingual data
   
2. If TMDB fails → OMDb fallback
   → Gets: basic metadata, plot, IMDb ID, ratings

3. If OMDb fails → Wikidata SPARQL
   → Gets: release date, cast (as Wikidata entities), basic info

4. Manual override always available in admin panel
```

**Key insight:** The TMDB block is on the *client/browser* side — ISPs block browser requests to TMDB. Our **Node.js backend server runs on Render in the US**, so it can call TMDB freely. The React frontend calls OUR backend, never TMDB directly. This completely bypasses the ISP block.

### The "Mapping Problem" — Custom Entities Not in Any API

When you want to link a movie or cast member to something that doesn't exist in any API (a local film, a custom list, a regional star not in TMDB), the solution is:

- **Everything gets saved to our MongoDB after the first API fetch.** Once a movie is in our DB, it's fully ours — we enrich it, relate it, tag it, add clips, comments, and explanations.
- **Admin "Quick Add" form** — creates a movie/cast record manually from scratch, identical schema, no API needed.
- **IMDb ID field** — optional cross-reference. If a record has an IMDb ID, we can enrich it later. If not, it's a fully custom record.
- **Result:** API-sourced and manually-created entities are identical in the DB. All features (favourites, tags, clips, collections, cast mapping) work on both equally.

---

## 4. Data Models (Final)

### 4.1 Movie
```json
{
  "_id": "ObjectId",
  "title": "string",
  "originalTitle": "string",
  "language": "string",           // "Hindi", "Telugu", "English", etc.
  "languages": ["string"],        // all languages in the film
  "genre": ["string"],
  "releaseDate": "Date",
  "status": "released | upcoming",
  "posterUrl": "string",
  "bannerUrl": "string",
  "synopsis": "string",           // short (from API)
  "explanation": "string",        // long AI-generated or user-written
  "explanationGeneratedAt": "Date",
  "rating": "number",
  "imdbId": "string",             // optional, for cross-referencing
  "tmdbId": "string",             // optional
  "dataSource": "tmdb | omdb | wikidata | manual",
  "cast": [
    {
      "castId": "ObjectId → Cast",
      "characterName": "string",
      "role": "Actor | Director | Producer | Composer | etc."
    }
  ],
  "userTags": ["string"],         // user-created tags assigned to this movie
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 4.2 Cast Member
```json
{
  "_id": "ObjectId",
  "name": "string",
  "photoUrl": "string",
  "bio": "string",
  "birthDate": "Date",
  "nationality": "string",
  "knownFor": "string",           // "Actor", "Director", "Composer", etc.
  "movies": ["ObjectId → Movie"], // back-reference
  "imdbId": "string",
  "tmdbId": "string",
  "dataSource": "string",
  "userTags": ["string"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 4.3 Clip
```json
{
  "_id": "ObjectId",
  "movieId": "ObjectId → Movie",
  "title": "string",
  "url": "string",                // manually entered by user
  "description": "string",
  "clipType": "trailer | scene | interview | song | bts | other",
  "castInvolved": ["ObjectId → Cast"],
  "userTags": ["string"],
  "addedBy": "ObjectId → User",
  "createdAt": "Date"
}
```

### 4.4 User
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "passwordHash": "string",
  "role": "user | admin",
  "favourites": {
    "movies":  [{ "entityId": "ObjectId", "category": "default | catA | catB | custom", "customCatName": "string" }],
    "cast":    [{ "entityId": "ObjectId", "category": "default | catA | catB | custom", "customCatName": "string" }],
    "clips":   [{ "entityId": "ObjectId", "category": "default" }]
  },
  "collections": [
    {
      "_id": "ObjectId",
      "name": "string",           // user-named, like Instagram saved collections
      "description": "string",
      "coverImage": "string",
      "items": [
        { "entityType": "movie | cast | clip", "entityId": "ObjectId" }
      ],
      "createdAt": "Date"
    }
  ],
  "tags": [
    {
      "_id": "ObjectId",
      "name": "string",           // user-created tag label
      "color": "string",          // optional colour for UI
      "createdAt": "Date"
    }
  ],
  "createdAt": "Date"
}
```

### 4.5 Comment (Private, User-only)
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId → User",
  "entityType": "movie | cast | clip",
  "entityId": "ObjectId",
  "text": "string",               // short note/message (max ~500 chars)
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
> Comments are fetched only when the authenticated user requests their own data. Never exposed to other users.

---

## 5. Feature Breakdown (Final)

### 5.1 Movie Catalogue
- Browse all movies (past + upcoming, all languages)
- Filters: language, genre, status, year, tags
- Movie cards with poster, title, language badge, status badge

### 5.2 Movie Detail Page
- Poster, banner, full metadata
- Full cast list → each cast member links to their profile
- User's **private comment** section (notes only they see)
- **AI Explanation** button → calls Claude API to generate explanation
- Clips section (filtered to this movie)
- Favourite + Collection + Tag controls

### 5.3 Cast Profiles & Bidirectional Mapping *(Core Feature)*
- Cast profile: photo, bio, filmography
- Filmography shows all movies + character name + role
- On Movie page: all cast with character names, each clickable
- **Bidirectional:** Movie → Cast and Cast → Movie, both navigable
- User's private comment on a cast member

### 5.4 Favourites System with Categories
- **Toggle heart** on any movie, cast member, or clip
- **Three built-in categories:**
  - `Default` — standard favourite (all clips go here by default)
  - `Cat A` — user can rename this (e.g. "Must Watch Again")
  - `Cat B` — user can rename this (e.g. "Top Picks")
- **Custom category:** user can create any number of named categories
- Favourites page with **tab toggle**: Movies | Cast
  - Each tab shows items grouped by category
  - Filters within each tab: language, genre, role, etc.
- All favourite clips go to **Default** category (as specified)
- User can reassign any favourite to a different category at any time

### 5.5 Favourite Clips
- Clips section/page: browse all added clips
- Filter by: movie, cast involved, clip type, tag
- Mark any clip as favourite (→ Default category automatically)
- Dedicated **"My Favourite Clips"** view within Favourites page

### 5.6 Movie Explanations (AI-Generated)
- "Generate Explanation" button on Movie Detail page
- Calls Claude API via our backend with movie title, cast, synopsis
- Generated explanation stored in `movie.explanation` field
- Shows timestamp of when it was generated
- User can also manually write/edit the explanation in admin panel

### 5.7 Collections (Instagram-style Save Lists)
- Users can create named collections (like Instagram "Saved" collections)
- Any movie, cast member, or clip can be added to one or more collections
- Collection has: name, optional description, optional cover image
- **Collection Detail page:** grid view of all saved items
- Collections are private to the user

### 5.8 User Tags (User-Created, Assignable to Entities)
- User creates tags from a Tags Manager page (name + optional colour)
- Tags can be assigned to: **movies, cast members, clips** — any combination
- Tags are editable (rename, recolour) and deletable from Tags Manager
- Tags appear as coloured chips on entity cards/pages
- **Filter by tag** works across Movies, Cast, Clips pages
- Tags are per-user (your tags are yours only)

### 5.9 Private Comments
- Small "Notes" section on every Movie, Cast, and Clip detail page
- User types a short message (personal annotation, thoughts, reminders)
- Only visible to the user who wrote it — completely private
- Edit and delete supported

### 5.10 Admin Panel
- Protected route (`/admin`), admin role only
- **Movie Manager:** search → auto-populate from API → review → save; or manual add
- **Cast Manager:** add/edit cast, assign to movies with character name + role
- **Clip Manager:** add clips with URL, movie, cast tags
- **Explanation Editor:** write or trigger AI generation per movie
- **User Manager:** view users, promote to admin

---

## 6. API Endpoints (Backend)

### Movies
```
GET    /api/movies                → list + filter
GET    /api/movies/:id            → detail with cast populated
POST   /api/movies                → add (admin) — triggers API fetch
PUT    /api/movies/:id            → edit (admin)
DELETE /api/movies/:id            → delete (admin)
GET    /api/movies/search?q=      → search title (admin: triggers external API)
POST   /api/movies/:id/explanation → generate AI explanation (admin)
```

### Cast
```
GET    /api/cast                  → list + filter
GET    /api/cast/:id              → detail with movies
POST   /api/cast                  → add (admin)
PUT    /api/cast/:id              → edit (admin)
```

### Clips
```
GET    /api/clips                 → list + filter by movie/cast/type/tag
POST   /api/clips                 → add clip
PUT    /api/clips/:id             → edit clip
DELETE /api/clips/:id             → delete clip
```

### Favourites
```
GET    /api/favourites                           → all favourites (movies+cast+clips)
POST   /api/favourites/movies/:id               → toggle favourite movie
POST   /api/favourites/cast/:id                 → toggle favourite cast
POST   /api/favourites/clips/:id                → toggle favourite clip
PATCH  /api/favourites/movies/:id/category      → set category
PATCH  /api/favourites/cast/:id/category        → set category
```

### Collections
```
GET    /api/collections                         → list user's collections
POST   /api/collections                         → create collection
PUT    /api/collections/:id                     → edit collection
DELETE /api/collections/:id                     → delete collection
POST   /api/collections/:id/items               → add item to collection
DELETE /api/collections/:id/items/:entityId     → remove item
```

### Tags
```
GET    /api/tags                                → user's tags
POST   /api/tags                                → create tag
PUT    /api/tags/:id                            → edit tag
DELETE /api/tags/:id                            → delete tag
POST   /api/tags/:tagId/assign                  → assign tag to entity
DELETE /api/tags/:tagId/assign/:entityId        → remove tag from entity
```

### Comments
```
GET    /api/comments?entityType=movie&entityId=  → get user's comments on entity
POST   /api/comments                             → add comment
PUT    /api/comments/:id                         → edit comment
DELETE /api/comments/:id                         → delete comment
```

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
```

---

## 7. Minimal DB Storage Policy (Confirmed)

Only the following data lives in MongoDB:

| Data | Stored in DB? | Notes |
|---|---|---|
| Movie metadata (title, poster, cast) | ✅ Yes | Saved after API fetch; enables custom enrichment |
| Cast metadata | ✅ Yes | Same as above |
| User accounts | ✅ Yes | Email, hashed password, role |
| User favourites | ✅ Yes | With category labels |
| User collections | ✅ Yes | Names + item references |
| User tags | ✅ Yes | Tag definitions + assignments |
| User comments | ✅ Yes | Private notes |
| Clips | ✅ Yes | User-added URLs + metadata |
| AI explanations | ✅ Yes | Stored on movie document after generation |
| Movie search cache (transient) | ❌ Not persisted | Only used during admin search |

---

## 8. Deployment (Free Tier)

| Service | Purpose | Free Limits |
|---|---|---|
| **MongoDB Atlas M0** | Database | 512MB, shared cluster, always free |
| **Render.com** | Node.js/Express backend | 750 hrs/month; sleeps after 15 min inactivity |
| **Vercel** | React frontend | Unlimited deploys, global CDN |

> **Note on Render sleep:** On the free tier, the backend sleeps after 15 min of inactivity and takes ~30 seconds to wake on first request. This is fine for personal use. A free cron ping service (e.g. cron-job.org) can keep it awake if needed.

---

## 9. Folder Structure

```
cinetrack/
├── client/                        # React (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Movies.jsx
│   │   │   ├── MovieDetail.jsx
│   │   │   ├── Cast.jsx
│   │   │   ├── CastDetail.jsx
│   │   │   ├── Favourites.jsx     # tabs: Movies | Cast; grouped by category
│   │   │   ├── Clips.jsx
│   │   │   ├── Collections.jsx
│   │   │   ├── CollectionDetail.jsx
│   │   │   ├── Tags.jsx           # tag manager
│   │   │   ├── Admin/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── MovieManager.jsx
│   │   │   │   ├── CastManager.jsx
│   │   │   │   └── ClipManager.jsx
│   │   │   └── Auth/
│   │   │       ├── Login.jsx
│   │   │       └── Register.jsx
│   │   ├── components/
│   │   │   ├── MovieCard.jsx
│   │   │   ├── CastCard.jsx
│   │   │   ├── ClipCard.jsx
│   │   │   ├── FavouriteButton.jsx # with category selector
│   │   │   ├── TagChip.jsx
│   │   │   ├── CommentBox.jsx      # private notes widget
│   │   │   ├── CollectionPicker.jsx
│   │   │   └── AIExplanation.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── UserDataContext.jsx  # favourites, tags, collections
│   │   └── api/                    # axios wrappers
│
├── server/                        # Node.js + Express
│   ├── models/
│   │   ├── Movie.js
│   │   ├── Cast.js
│   │   ├── Clip.js
│   │   ├── User.js
│   │   └── Comment.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   │   ├── movieApiService.js     # TMDB → OMDb → Wikidata fallback chain
│   │   └── aiService.js           # Claude API integration
│   ├── middleware/
│   │   ├── auth.js                # JWT verify
│   │   └── adminOnly.js
│   └── index.js
│
└── README.md
```

---

## 10. Implementation Phases

| Phase | Scope |
|---|---|
| **1** | MongoDB models, Express server, Auth (JWT), Admin panel scaffold |
| **2** | Movie API service (TMDB proxy + fallback chain), Movie CRUD, Movie catalogue + detail page |
| **3** | Cast model, bidirectional Movie↔Cast mapping, Cast pages |
| **4** | Favourites with categories (Default/CatA/CatB/Custom), Favourites page with tabs + filters |
| **5** | Clips (manual URL add), Favourite clips, Clips filter page |
| **6** | Collections (Instagram-style), Tags (user-created, assignable) |
| **7** | Private Comments on movies/cast/clips |
| **8** | AI Explanation (Claude API), Explanation section on Movie Detail |
| **9** | Polish, deploy to Vercel + Render + Atlas |

---

## 11. All Confirmed Decisions Summary

- ✅ Auth: JWT login/register + admin role
- ✅ Movie data: TMDB via backend proxy (bypasses India ISP block) → OMDb → Wikidata fallback
- ✅ Manual add always available for any movie/cast not in APIs
- ✅ All languages supported (Bollywood, Tollywood, Hollywood, Kollywood, etc.)
- ✅ AI explanation via Claude API (on-demand, stored in DB)
- ✅ Clips: manually entered YouTube/external links
- ✅ DB stores: user data, favourites, collections, tags, comments, enriched movie/cast data only
- ✅ Favourites: Default + Cat A + Cat B + custom categories; all clips → Default
- ✅ Collections: Instagram-style named save lists for movies, cast, clips
- ✅ Tags: user-created, coloured, assignable to movies/cast/clips, filterable
- ✅ Comments: private per-user notes on any entity
- ✅ Deployment: Vercel + Render + MongoDB Atlas M0 (all free)

---

*Document v2.0 — Final confirmed requirements. Ready for Phase 1 implementation.*