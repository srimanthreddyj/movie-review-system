# MovieMapper

Live demo: https://moviemapper.netlify.app/

MovieMapper is a full-stack movie tracking and review application with user authentication, movie search, cast details, favourites, collections, comments, and admin features.

## Key Features

- **User Authentication**: Register, login, and JWT-based session management.
- **Movie Search & Discovery**: Search for movies, browse popular titles, and view movie details.
- **Movie Details**: See cast, clips, overview, ratings, and related content.
- **Cast Pages**: Browse cast members and view individual cast detail pages.
- **Collections**: Create and manage custom movie collections.
- **Favourites**: Mark movies as favourites for quick access.
- **Comments**: Add comments to movies and participate in discussions.
- **Tags**: Use tags to organize collections and discover content more easily.
- **Admin Controls**: Includes admin-specific pages and actions when authenticated as an admin user.

## Tech Stack

- Frontend: React, Vite, React Router, Axios
- Backend: Node.js, Express, MongoDB, Mongoose
- Authentication: JSON Web Tokens (JWT)
- Styling: CSS modules and component-level styles

## Repository Structure

```
Movie Review system/
├── client/           # React frontend application
├── server/           # Express backend API
├── netlify.toml      # Netlify build configuration
└── README.md         # Project overview and setup instructions
```

## Deployment

The frontend is deployed on Netlify at:

- https://moviemapper.netlify.app/

The production frontend uses `VITE_API_URL` to connect to the backend API.

## Environment Variables

### Frontend

Create `client/.env` locally with:

```env
VITE_API_URL=https://moviemapper.netlify.app/api
```

### Backend

Create `server/.env` locally with:

```env
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
TMDB_API_KEY=<your-tmdb-api-key>
OMDB_API_KEY=<your-omdb-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

> Note: `server/.env` and `client/.env` are ignored by Git and must remain local.

## Local Development

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

The frontend development server runs on Vite, and it calls the backend via the configured API base URL.

## Git Notes

- `ApiKeys.txt` was removed from the repository to protect secret API keys.
- Local `.env` files are not tracked.

## Useful Links

- Frontend repo: `client/`
- Backend repo: `server/`
- Netlify config: `netlify.toml`
