import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { tmdbService } from '@/services/tmdb';
import { databaseService } from '@/services/database';
import type { MovieDetails } from '@/types/movie';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    loadMovieDetails();
    loadUserRating();
    loadWatchlistStatus();
  }, [id]);

  const loadMovieDetails = async () => {
    try {
      setLoading(true);
      const details = await tmdbService.getMovieDetails(Number(id));
      setMovie(details);
    } catch (error) {
      console.error('Error loading movie details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRating = async () => {
    const rating = await databaseService.getMovieRating(Number(id));
    setUserRating(rating);
  };

  const loadWatchlistStatus = async () => {
    const status = await databaseService.isInWatchlist(Number(id));
    setInWatchlist(status);
  };

  const toggleWatchlist = async () => {
    if (!movie) return;

    // Optimistically update UI immediately
    const newStatus = !inWatchlist;
    setInWatchlist(newStatus);

    // Run database operation in background
    try {
      if (newStatus) {
        await databaseService.addToWatchlist(movie.id, {
          title: movie.title,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
        });
      } else {
        await databaseService.removeFromWatchlist(movie.id);
      }
    } catch (error) {
      // Revert on error
      console.error('Error updating watchlist:', error);
      setInWatchlist(!newStatus);
    }
  };

  const handleRating = async (rating: number) => {
    if (!movie) return;

    // Immediately update UI for responsiveness
    setUserRating(rating);

    // Save rating to database with rich metadata
    const director = movie.credits?.crew?.find(c => c.job === 'Director');
    const topActors = movie.credits?.cast?.slice(0, 5).map(a => a.name) || [];
    const keywords = movie.keywords?.keywords?.map(k => k.name) || [];
    const productionCompany = movie.production_companies?.[0]?.name;

    const saveRating = databaseService.rateMovie(movie.id, rating, {
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
      genre_ids: movie.genres.map(g => g.id),
      director: director?.name,
      actors: topActors,
      keywords: keywords.slice(0, 10), // Top 10 keywords
      production_company: productionCompany,
    });

    // Update genre preferences for likes (run in background)
    if (rating >= 4 || rating === 1) {
      const updatePreferences = async () => {
        const currentPrefs = await databaseService.getGenrePreferences();

        // Batch all genre updates in parallel
        await Promise.all(
          movie.genres.map(async (genre) => {
            const existing = currentPrefs.find((p) => p.genre_id === genre.id);
            const newWeight = (existing?.weight || 0) + 1;
            return databaseService.updateGenrePreference(genre.id, newWeight);
          })
        );
      };

      // Run both operations in parallel, but don't block the UI
      Promise.all([saveRating, updatePreferences()]).catch(error => {
        console.error('Error saving rating:', error);
      });
    } else {
      // For dislikes, just save the rating
      saveRating.catch(error => {
        console.error('Error saving rating:', error);
      });
    }
  };

  const openTrailer = () => {
    if (!movie?.videos?.results.length) return;

    const trailer = movie.videos.results.find(
      (video) => video.type === 'Trailer' && video.site === 'YouTube'
    );

    if (trailer) {
      const url = tmdbService.getYoutubeUrl(trailer.key);
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load movie details</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const trailer = movie.videos?.results.find(
    (video) => video.type === 'Trailer' && video.site === 'YouTube'
  );

  return (
    <ScrollView style={styles.container}>
      {/* Backdrop Image */}
      <View style={styles.backdropContainer}>
        <Image
          source={{
            uri: tmdbService.getImageUrl(movie.backdrop_path, 'backdrop') || '',
          }}
          style={styles.backdrop}
          contentFit="cover"
        />
        <View style={styles.backdropOverlay} />

        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Movie Info */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={{ uri: tmdbService.getImageUrl(movie.poster_path) || '' }}
            style={styles.poster}
            contentFit="cover"
          />

          <View style={styles.headerInfo}>
            <Text style={styles.title}>{movie.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.rating}>⭐ {movie.vote_average.toFixed(1)}</Text>
              <Text style={styles.year}>
                {new Date(movie.release_date).getFullYear()}
              </Text>
              {movie.runtime && (
                <Text style={styles.runtime}>{movie.runtime} min</Text>
              )}
            </View>
            <View style={styles.genres}>
              {movie.genres.map((genre) => (
                <View key={genre.id} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Rating Buttons */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>Rate this movie</Text>
          <View style={styles.ratingButtons}>
            <Pressable
              style={[
                styles.ratingButton,
                userRating === -1 && styles.ratingButtonDislike,
              ]}
              onPress={() => handleRating(-1)}
            >
              <Text style={styles.ratingButtonIcon}>👎</Text>
              <Text style={styles.ratingButtonText}>Dislike</Text>
            </Pressable>

            <Pressable
              style={[
                styles.ratingButton,
                userRating === 1 && styles.ratingButtonLike,
              ]}
              onPress={() => handleRating(1)}
            >
              <Text style={styles.ratingButtonIcon}>👍</Text>
              <Text style={styles.ratingButtonText}>Like</Text>
            </Pressable>
          </View>
          {userRating !== null && (
            <Text style={styles.ratedText}>
              ✓ You rated this movie
            </Text>
          )}
        </View>

        {/* Watchlist Button */}
        <Pressable
          style={[styles.watchlistButton, inWatchlist && styles.watchlistButtonActive]}
          onPress={toggleWatchlist}
        >
          <Text style={styles.watchlistButtonIcon}>
            {inWatchlist ? '✓' : '+'}
          </Text>
          <Text style={styles.watchlistButtonText}>
            {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          </Text>
        </Pressable>

        {/* Tagline */}
        {movie.tagline && (
          <Text style={styles.tagline}>"{movie.tagline}"</Text>
        )}

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
        </View>

        {/* Trailer */}
        {trailer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trailer</Text>
            <Pressable style={styles.trailerButton} onPress={openTrailer}>
              <Text style={styles.trailerButtonText}>▶ Watch Trailer</Text>
            </Pressable>
          </View>
        )}

        {/* Cast */}
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cast</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {movie.credits.cast.slice(0, 10).map((person) => (
                <View key={person.id} style={styles.castCard}>
                  <Image
                    source={{
                      uri: tmdbService.getImageUrl(person.profile_path, 'profile') || '',
                    }}
                    style={styles.castImage}
                    contentFit="cover"
                  />
                  <Text style={styles.castName} numberOfLines={2}>
                    {person.name}
                  </Text>
                  <Text style={styles.castCharacter} numberOfLines={2}>
                    {person.character}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Votes</Text>
            <Text style={styles.statValue}>{movie.vote_count.toLocaleString()}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Popularity</Text>
            <Text style={styles.statValue}>{Math.round(movie.popularity)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Language</Text>
            <Text style={styles.statValue}>{movie.original_language.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    marginTop: -60,
    marginBottom: 24,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rating: {
    color: '#ffd700',
    fontSize: 16,
  },
  year: {
    color: '#999',
    fontSize: 16,
  },
  runtime: {
    color: '#999',
    fontSize: 16,
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  genreText: {
    color: '#999',
    fontSize: 12,
  },
  ratingSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  ratingButtonLike: {
    backgroundColor: '#1b5e20',
    borderColor: '#4caf50',
  },
  ratingButtonDislike: {
    backgroundColor: '#7f1d1d',
    borderColor: '#f44336',
  },
  ratingButtonIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  ratingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ratedText: {
    color: '#4caf50',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  watchlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#333',
    gap: 8,
  },
  watchlistButtonActive: {
    backgroundColor: '#1a4d2e',
    borderColor: '#4caf50',
  },
  watchlistButtonIcon: {
    fontSize: 20,
    color: '#fff',
  },
  watchlistButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ccc',
  },
  trailerButton: {
    backgroundColor: '#c62828',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  trailerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  castCard: {
    width: 100,
    marginRight: 12,
  },
  castImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  castName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  castCharacter: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
