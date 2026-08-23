# 🎬 MovieMapper

**Live Demo**: [https://moviemapper.netlify.app/](https://moviemapper.netlify.app/)

MovieMapper is a full-stack movie tracking and review application. It allows you to search for movies, view comprehensive cast details, curate private collections, favorite clips, and write personal reviews. It also features a robust **Admin Dashboard** for managing content and monitoring system metrics.

---

## ⚡ Core Features

- **Auth & Security**: Secure user registration, login, and JWT-based session management.
- **Hybrid Data Fetching**: Seamlessly fetches movie and cast data from TMDB/OMDb APIs via a backend proxy, bypassing regional ISP blocks.
- **Collections & Favourites**: Create custom, Instagram-style collections and favorite specific movies, cast members, and video clips.
- **AI Explanations**: One-click AI-generated movie plot explanations powered by Claude/Gemini.
- **Admin Dashboard**: Live system metrics, content management tools, and API kill-switches.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your machine:

1. **[Node.js](https://nodejs.org/en/)** (v16.0 or higher)
2. **[Git](https://git-scm.com/)**
3. A **[MongoDB Atlas](https://www.mongodb.com/atlas/database)** account (Free Tier works fine)
4. Free API keys from the following services:
   - [TMDB API Key](https://developer.themoviedb.org/docs)
   - [OMDb API Key](https://www.omdbapi.com/apikey.aspx)
   - [Google Gemini API Key](https://aistudio.google.com/app/apikey) (or Claude)

---

## 🚀 Local Setup Instructions

Follow these steps to run the project locally.

### 1. Clone the Repositories
```bash
# Clone Backend Repository
git clone https://github.com/<YOUR-USERNAME>/moviemapper-backend.git
cd moviemapper-backend

# Clone Frontend Repository
git clone https://github.com/<YOUR-USERNAME>/moviemapper-frontend.git
cd moviemapper-frontend
```

### 2. Configure the Backend
Navigate to the server directory, install dependencies, and create your environment file.

```bash
cd server
npm install
```

Create a new file named `.env` in the `server/` directory and add your API keys:
```env
PORT=5000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-custom-secure-random-string>
TMDB_API_KEY=<your-tmdb-api-key>
OMDB_API_KEY=<your-omdb-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

Start the backend server:
```bash
npm run dev
```
*The server will start on `http://localhost:5000`.*

### 3. Configure the Frontend
Open a new terminal window, navigate to the client directory, install dependencies, and setup the environment.

```bash
cd client
npm install
```

Create a new file named `.env` in the `client/` directory to point the React app to your local backend:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend development server:
```bash
npm run dev
```
*The app will automatically open in your browser (usually at `http://localhost:5173`).*

---

## 🏗️ Technology Stack

- **Frontend**: React, Vite, React Router
- **Backend**: Node.js, Express
- **Database**: MongoDB & Mongoose
- **Styling**: Vanilla CSS with glassmorphic, premium UI design
- **Deployment**: Netlify (Frontend) & Render (Backend)

*(Note: Sensitive scripts like database resets and API keys have been securely untracked from this repository).*
