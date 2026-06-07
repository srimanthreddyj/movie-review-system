import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import CastCard from '../components/CastCard';
import { Film, Users, Heart, FolderOpen, ArrowRight, Activity, Smile, Loader2 } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    movies: 0,
    cast: 0,
    favourites: 0,
    collections: 0
  });
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularCast, setPopularCast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        // Load stats and popular sections in parallel
        const [moviesRes, castRes, favsRes, colRes, popularMoviesRes, popularCastRes] = await Promise.all([
          api.get('/movies?limit=1'),
          api.get('/cast?limit=1'),
          api.get('/favourites'),
          api.get('/collections'),
          api.get('/movies/popular'),
          api.get('/cast/popular')
        ]);

        const favsList = favsRes.data;
        const favsCount = (favsList.movies?.length || 0) + (favsList.cast?.length || 0) + (favsList.clips?.length || 0);

        setStats({
          movies: moviesRes.data.totalMovies || 0,
          cast: castRes.data.totalCasts || 0,
          favourites: favsCount,
          collections: colRes.data.length || 0
        });

        // Set popular movies and cast (limit to 4 on dashboard)
        setPopularMovies((popularMoviesRes.data || []).slice(0, 4));
        setPopularCast((popularCastRes.data || []).slice(0, 4));

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
          Welcome to CineTrack, your personal catalogue for tracking movies, TV shows, and cast members.
        </p>
      </header>

      {/* Stats Cards Row */}
      {user?.role === 'admin' && (
        <section className="stats-section">
          <h2 className="section-title flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
            <Activity size={18} />
            <span>Overview Stats</span>
          </h2>
          <div className="stats-grid">
            <div className="stat-card flex-between">
              <div>
                <span className="stat-label">Tracked Movies</span>
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
      )}

      {/* Popular Movies Section */}
      <section className="dashboard-section" style={{ marginBottom: '2.5rem' }}>
        <div className="flex-between section-header-row">
          <h2 className="section-title">Popular Movies (TMDB)</h2>
          <Link to="/movies" className="explore-all-link flex-center">
            <span>Explore Movies</span>
            <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
          </Link>
        </div>

        {loading ? (
          <div className="section-loading flex-center">
            <Loader2 size={24} className="spinner" style={{ marginRight: '0.5rem' }} />
            <span>Loading popular movies...</span>
          </div>
        ) : popularMovies.length === 0 ? (
          <div className="empty-section-message">
            No popular movies cached yet. Check back shortly.
          </div>
        ) : (
          <div className="grid-cards">
            {popularMovies.map((movie) => (
              <MovieCard 
                key={movie.refId || movie._id} 
                movie={movie} 
                userFavourites={[]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Popular Cast Section */}
      <section className="dashboard-section">
        <div className="flex-between section-header-row">
          <h2 className="section-title">Popular Cast Members</h2>
          <Link to="/cast" className="explore-all-link flex-center">
            <span>Explore Cast</span>
            <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
          </Link>
        </div>
        
        {loading ? (
          <div className="section-loading flex-center">
            <Loader2 size={24} className="spinner" style={{ marginRight: '0.5rem' }} />
            <span>Loading popular cast...</span>
          </div>
        ) : popularCast.length === 0 ? (
          <div className="empty-section-message">
            No popular cast profiles cached yet. Check back shortly.
          </div>
        ) : (
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {popularCast.map((actress) => (
              <CastCard 
                key={actress.refId || actress._id} 
                cast={actress} 
                userFavourites={[]}
              />
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

        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Home;
