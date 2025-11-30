import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SwipeCard } from '@/components/SwipeCard';
import { tmdbService } from '@/services/tmdb';
import { databaseService } from '@/services/database';
import type { Movie } from '@/types/movie';

const MIN_RATINGS = 10; // Minimum number of ratings before proceeding
const PRELOAD_THRESHOLD = 3; // Start loading more when this many cards left

export default function OnboardingScreen() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);

  useEffect(() => {
    loadMovies(1);
  }, []);

  // Preload more movies when getting close to the end
  useEffect(() => {
    const moviesRemaining = movies.length - currentIndex;
    if (moviesRemaining <= PRELOAD_THRESHOLD && !loadingMore && hasMoreMovies) {
      loadMoreMovies();
    }
  }, [currentIndex, movies.length, loadingMore, hasMoreMovies]);

  const loadMovies = async (page: number) => {
    try {
      setLoading(true);
      const newMovies = await fetchMoviesPage(page);
      setMovies(newMovies);
      setCurrentPage(page);
      setCurrentIndex(0);
      setHasMoreMovies(newMovies.length > 0);
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMovies = async () => {
    if (loadingMore) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const newMovies = await fetchMoviesPage(nextPage);

      if (newMovies.length > 0) {
        setMovies(prev => [...prev, ...newMovies]);
        setCurrentPage(nextPage);
        setHasMoreMovies(true);
      } else {
        setHasMoreMovies(false);
      }
    } catch (error) {
      console.error('Error loading more movies:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchMoviesPage = async (page: number): Promise<Movie[]> => {
    // Get already rated movie IDs to filter them out
    const ratedMovies = await databaseService.getAllRatings();
    const ratedMovieIds = new Set(ratedMovies.map(r => r.movie_id));

    // Fetch one page at a time for faster initial load
    const pageType = page % 3;
    let response;

    if (pageType === 1) {
      response = await tmdbService.getTopRatedMovies(Math.ceil(page / 3));
    } else if (pageType === 2) {
      response = await tmdbService.getPopularMovies(Math.ceil(page / 3));
    } else {
      response = await tmdbService.getTrendingMovies('week');
    }

    // Filter out already rated movies
    const unrated = response.results.filter(movie => !ratedMovieIds.has(movie.id));

    // Shuffle for variety
    return unrated.sort(() => Math.random() - 0.5);
  };

  const handleSwipe = async (isLike: boolean) => {
    const movie = movies[currentIndex];
    if (!movie) return;

    // Store rating: 1 for like, -1 for dislike
    const rating = isLike ? 1 : -1;
    await databaseService.rateMovie(movie.id, rating, {
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
    });

    // Update genre preferences
    if (isLike) {
      const currentPrefs = await databaseService.getGenrePreferences();
      for (const genreId of movie.genre_ids) {
        const existing = currentPrefs.find(p => p.genre_id === genreId);
        const newWeight = (existing?.weight || 0) + 1;
        await databaseService.updateGenrePreference(genreId, newWeight);
      }
    }

    const newCount = ratingsCount + 1;
    setRatingsCount(newCount);

    // Move to next movie
    goToNextMovie();
  };

  const handleSkipMovie = () => {
    // Just move to next without rating
    goToNextMovie();
  };

  const goToNextMovie = () => {
    if (currentIndex < movies.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    // Pagination automatically loads more via useEffect
  };

  const handleSkip = () => {
    if (ratingsCount >= MIN_RATINGS) {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    );
  }

  const currentMovie = movies[currentIndex];
  const progress = (ratingsCount / MIN_RATINGS) * 100;
  const canProceed = ratingsCount >= MIN_RATINGS;

  // No more movies available
  if (!currentMovie && movies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>All Caught Up!</Text>
          <Text style={styles.headerSubtitle}>
            You've rated all available movies
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>🎬</Text>
          <Text style={styles.emptyMessage}>
            Great job! You've rated {ratingsCount} movies.
          </Text>
          <Pressable style={styles.continueButton} onPress={() => router.replace('/')}>
            <Text style={styles.continueButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rate Movies You Know</Text>
        <Text style={styles.headerSubtitle}>
          Swipe right to like, left to pass
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressText}>
              {ratingsCount}/{MIN_RATINGS} rated
            </Text>
            {loadingMore && (
              <ActivityIndicator size="small" color="#4caf50" style={styles.loadingIndicator} />
            )}
          </View>
        </View>
      </View>

      <View style={styles.cardContainer}>
        {currentMovie && (
          <SwipeCard
            key={currentMovie.id}
            movie={currentMovie}
            onSwipeLeft={() => handleSwipe(false)}
            onSwipeRight={() => handleSwipe(true)}
          />
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={() => handleSwipe(false)}>
          <Text style={styles.actionIcon}>✕</Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkipMovie}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => handleSwipe(true)}>
          <Text style={styles.actionIcon}>♥</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        {canProceed && (
          <Pressable style={styles.continueButton} onPress={handleSkip}>
            <Text style={styles.continueButtonText}>Continue to App</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>
          {canProceed
            ? 'You can continue or keep rating for better recommendations!'
            : `Rate ${MIN_RATINGS - ratingsCount} more to continue`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 4,
  },
  progressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#999',
  },
  loadingIndicator: {
    marginLeft: 4,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
  },
  actionIcon: {
    fontSize: 28,
    color: '#fff',
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  skipButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 12,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#999',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyMessage: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
});
