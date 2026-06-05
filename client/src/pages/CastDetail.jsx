import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getProxiedImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FavouriteButton from '../components/FavouriteButton';
import MovieCard from '../components/MovieCard';
import CommentSection from '../components/CommentSection';
import AddToCollectionModal from '../components/AddToCollectionModal';
import { ArrowLeft, User, Calendar, Globe, AlertTriangle, Video, FolderPlus } from 'lucide-react';

const CastDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [castMember, setCastMember] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Favourites state
  const [userFavs, setUserFavs] = useState([]);

  // Collection Modal State
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  useEffect(() => {
    fetchCastDetails();
    fetchUserFavourites();
  }, [id]);

  const fetchCastDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/cast/${id}`);
      setCastMember(response.data.castMember);
      setFilmography(response.data.filmography || []);
    } catch (err) {
      console.error('Failed to load cast details:', err);
      setError(err.response?.data?.message || 'Could not find the requested cast member.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserFavourites = async () => {
    try {
      const response = await api.get('/favourites');
      setUserFavs(response.data.cast || []);
    } catch (err) {
      console.error('Failed to load user favourites:', err);
    }
  };

  if (loading) {
    return <div className="container loading-view flex-center">Loading profile...</div>;
  }

  if (error || !castMember) {
    return (
      <div className="container error-view flex-center">
        <AlertTriangle size={40} className="text-danger" />
        <h2>{error || 'Cast member not found'}</h2>
        <Link to="/cast" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
          Back to Cast profiles
        </Link>
      </div>
    );
  }

  const { name, photoUrl, bio, birthDate, nationality, gender, knownFor } = castMember;
  const isFemale = gender === 'Female';

  return (
    <div className="container detail-container">
      {/* Back button */}
      <Link to="/cast" className="back-link flex-center" style={{ justifyContent: 'flex-start', marginBottom: '1.5rem', gap: '0.25rem' }}>
        <ArrowLeft size={14} />
        <span>Back to Cast profiles</span>
      </Link>

      {/* Main Profile Columns */}
      <div className="profile-grid">
        {/* Left side: Photo & basic stats */}
        <div className="profile-left-col">
          <div className={`profile-photo-wrapper ${isFemale ? 'actress-highlight' : ''}`}>
            {photoUrl ? (
              <img src={getProxiedImageUrl(photoUrl)} alt={name} className="profile-photo" />
            ) : (
              <div className="profile-photo-fallback flex-center">
                <User size={64} />
              </div>
            )}
            {isFemale && (
              <span className="badge badge-female profile-gender-badge">Actress</span>
            )}
          </div>

          <div className="profile-stats-card">
            <h3>Profile Summary</h3>
            <div className="stat-row flex-between">
              <span className="stat-title">Gender</span>
              <span className="stat-desc">{gender || 'Unspecified'}</span>
            </div>
            {knownFor && (
              <div className="stat-row flex-between">
                <span className="stat-title">Role</span>
                <span className="stat-desc">{knownFor}</span>
              </div>
            )}
            {nationality && (
              <div className="stat-row flex-between">
                <span className="stat-title">Nationality</span>
                <span className="stat-desc">{nationality}</span>
              </div>
            )}
            {birthDate && (
              <div className="stat-row flex-between">
                <span className="stat-title">Born</span>
                <span className="stat-desc">
                  {new Date(birthDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <div className="flex-center" style={{ marginTop: '1.5rem', gap: '0.75rem', flexDirection: 'column', width: '100%' }}>
            <FavouriteButton 
              entityType="cast" 
              entityId={id} 
              favouritesList={userFavs}
              onUpdate={fetchUserFavourites}
            />
            <button 
              onClick={() => setIsCollectionModalOpen(true)}
              className="btn btn-secondary flex-center"
              style={{ gap: '0.5rem', width: '100%', minHeight: '40px' }}
            >
              <FolderPlus size={16} />
              <span>Save to Collection</span>
            </button>
          </div>
        </div>

        {/* Right side: Bio & Dynamic Filmography */}
        <div className="profile-right-col">
          <section className="profile-section">
            <h1 className="profile-name">{name}</h1>
            <p className="profile-bio-text">{bio || 'No biography details provided.'}</p>
          </section>

          {/* Filmography Section */}
          <section className="profile-section">
            <h2>Filmography</h2>
            {filmography.length === 0 ? (
              <div className="empty-filmography flex-center">
                <span>No tracked movies or series linked to this profile.</span>
              </div>
            ) : (
              <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {filmography.map((film) => (
                  <MovieCard 
                    key={film.movieId}
                    movie={{
                      _id: film.movieId,
                      title: film.title,
                      releaseDate: film.releaseDate,
                      posterUrl: film.posterUrl,
                      mediaType: 'movie' // defaults to movie for listing card
                    }}
                    userFavourites={[]}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Private Notes Section */}
      <CommentSection entityType="cast" entityId={id} />

      <AddToCollectionModal 
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        entityType="cast"
        entityId={id}
      />

      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 2.5rem;
        }
        @media (max-width: 768px) {
          .profile-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }
        .profile-left-col {
          display: flex;
          flex-direction: column;
        }
        .profile-photo-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          overflow: hidden;
          background-color: var(--bg-secondary);
          box-shadow: var(--shadow-sm);
          margin-bottom: 1.5rem;
        }
        .actress-highlight {
          border-color: #ec4899;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.1);
        }
        .profile-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-photo-fallback {
          height: 100%;
          color: var(--text-muted);
        }
        .profile-gender-badge {
          position: absolute;
          top: 0.75rem;
          left: 0.75rem;
          font-weight: 600;
        }
        
        .profile-stats-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.25rem;
        }
        .profile-stats-card h3 {
          font-size: 0.95rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 1rem;
        }
        .stat-row {
          font-size: 0.875rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color);
        }
        .stat-row:last-child {
          border-bottom: none;
        }
        .stat-title {
          color: var(--text-secondary);
        }
        .stat-desc {
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .profile-name {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 1rem;
        }
        .profile-bio-text {
          font-size: 1rem;
          line-height: 1.6;
          color: var(--text-secondary);
          white-space: pre-wrap;
          margin-bottom: 2rem;
        }
        .empty-filmography {
          padding: 3rem;
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
          color: var(--text-secondary);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default CastDetail;
