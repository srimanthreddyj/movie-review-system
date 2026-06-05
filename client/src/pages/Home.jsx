import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import CastCard from '../components/CastCard';
import { Film, Users, Heart, FolderOpen, ArrowRight, Activity, Smile } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    movies: 0,
    cast: 0,
    favourites: 0,
    notes: 0,
    collections: 0
  });
  const [recentMovies, setRecentMovies] = useState([]);
  const [featuredActresses, setFeaturedActresses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        // Load movies, cast, and favourites details in parallel
        const [moviesRes, castRes, favsRes, colRes] = await Promise.all([
          api.get('/movies'),
          api.get('/cast'),
          api.get('/favourites'),
          api.get('/collections')
        ]);

        const moviesList = moviesRes.data.movies || [];
        const castList = castRes.data.casts || [];
        const favsList = favsRes.data;
        const colList = colRes.data;

        // Calculate statistics
        const favsCount = (favsList.movies?.length || 0) + (favsList.cast?.length || 0) + (favsList.clips?.length || 0);
        
        setStats({
          movies: moviesList.length,
          cast: castList.length,
          favourites: favsCount,
          collections: colList.length
        });

        // Get recent 4 movies
        setRecentMovies(moviesList.slice(0, 4));

        // Get female cast members (Actresses) for featured block
        const actresses = castList
          .filter((member) => member.gender === 'Female')
          .slice(0, 4);
        setFeaturedActresses(actresses);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <div className="container dashboard-container">
      {/* Welcome Banner */}
      <header className="dashboard-header">
        <h1 className="welcome-text">
          <Smile size={32} className="welcome-icon" />
          <span>Hello, {user.name}</span>
        </h1>
        <p className="welcome-subtext">
          Welcome to CineTrack, your personal catalog for tracking films, TV series, and your favourite actresses.
        </p>
      </header>

      {/* Stats Cards Row */}
      <section className="stats-section">
        <h2 className="section-title flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
          <Activity size={18} />
          <span>Overview Stats</span>
        </h2>
        <div className="stats-grid">
          <div className="stat-card flex-between">
            <div>
              <span className="stat-label">Total Titles</span>
              <span className="stat-val">{stats.movies}</span>
            </div>
            <Film size={32} className="stat-icon" />
          </div>
          <div className="stat-card flex-between">
            <div>
              <span className="stat-label">Cast Profiles</span>
              <span className="stat-val">{stats.cast}</span>
            </div>
            <Users size={32} className="stat-icon" />
          </div>
          <div className="stat-card flex-between">
            <div>
              <span className="stat-label">Favourites</span>
              <span className="stat-val">{stats.favourites}</span>
            </div>
            <Heart size={32} className="stat-icon" />
          </div>
          <div className="stat-card flex-between">
            <div>
              <span className="stat-label">Collections</span>
              <span className="stat-val">{stats.collections}</span>
            </div>
            <FolderOpen size={32} className="stat-icon" />
          </div>
        </div>
      </section>

      {/* Featured Actresses (Female focus) */}
      <section className="featured-actresses-section">
        <div className="flex-between section-header-row">
          <h2 className="section-title">Featured Actresses</h2>
          <Link to="/cast" className="explore-all-link flex-center">
            <span>Explore Profiles</span>
            <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
          </Link>
        </div>
        
        {loading ? (
          <div className="section-loading">Loading actress profiles...</div>
        ) : featuredActresses.length === 0 ? (
          <div className="empty-section-message">
            No actress profiles added yet. Import or add some from the Admin Hub.
          </div>
        ) : (
          <div className="grid-cards">
            {featuredActresses.map((actress) => (
              <CastCard key={actress._id} cast={actress} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Movie Additions */}
      <section className="recent-movies-section">
        <div className="flex-between section-header-row">
          <h2 className="section-title">Recently Added</h2>
          <Link to="/movies" className="explore-all-link flex-center">
            <span>View Catalogue</span>
            <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
          </Link>
        </div>

        {loading ? (
          <div className="section-loading">Loading titles...</div>
        ) : recentMovies.length === 0 ? (
          <div className="empty-section-message">
            Your tracking catalogue is empty. Go to the Admin Hub to search and import your first title!
          </div>
        ) : (
          <div className="grid-cards">
            {recentMovies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </div>
        )}
      </section>

      <style>{`
        .dashboard-container {
          padding-top: 2rem;
          padding-bottom: 3rem;
          text-align: left;
        }
        .dashboard-header {
          margin-bottom: 2.5rem;
        }
        .welcome-text {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
          border: none;
          padding: 0;
        }
        .welcome-icon {
          color: var(--accent-color);
        }
        .welcome-subtext {
          font-size: 1rem;
          color: var(--text-secondary);
        }
        .stats-section {
          margin-bottom: 2.5rem;
        }
        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }
        .section-header-row {
          align-items: baseline;
          margin-bottom: 0.5rem;
        }
        .section-header-row .section-title {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .explore-all-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--accent-color);
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.25rem;
        }
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
        }
        .stat-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.25rem 1.5rem;
          transition: border-color var(--transition-speed);
        }
        @media (max-width: 640px) {
          .stat-card {
            padding: 1rem;
          }
        }
        .stat-card:hover {
          border-color: var(--text-muted);
        }
        .stat-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }
        .stat-val {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }
        .stat-icon {
          color: var(--text-muted);
          opacity: 0.5;
        }
        
        .section-loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .empty-section-message {
          padding: 3rem;
          text-align: center;
          background-color: var(--bg-secondary);
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
          color: var(--text-secondary);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default Home;
