import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { databaseService } from '@/services/database';
import { tmdbService } from '@/services/tmdb';
import type { UserRating } from '@/services/database';

export default function ProfileScreen() {
  const [watchlist, setWatchlist] = useState<UserRating[]>([]);
  const [ratedMovies, setRatedMovies] = useState<UserRating[]>([]);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'rated'>('watchlist');
  const [favoriteGenres, setFavoriteGenres] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [watchlistData, ratingsData, genres] = await Promise.all([
      databaseService.getWatchlist(),
      databaseService.getAllRatings(),
      databaseService.getFavoriteGenreIds(3),
    ]);
    setWatchlist(watchlistData);
    setRatedMovies(ratingsData);
    setFavoriteGenres(genres);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your ratings, preferences, and watchlist. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await databaseService.clearAllData();
            await loadData();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const handleRemoveFromWatchlist = async (movieId: number) => {
    await databaseService.removeFromWatchlist(movieId);
    await loadData();
  };

  const handleMoviePress = (movieId: number) => {
    router.push(`/movie/${movieId}`);
  };

  const likedCount = ratedMovies.filter((r) => r.rating === 1).length;
  const dislikedCount = ratedMovies.filter((r) => r.rating === -1).length;

  const renderMovieCard = (item: UserRating, showRemove: boolean = false) => {
    const movieData = item.movie_data ? JSON.parse(item.movie_data) : {};

    return (
      <Pressable
        key={item.id}
        style={styles.movieCard}
        onPress={() => handleMoviePress(item.movie_id)}
      >
        <Image
          source={{ uri: tmdbService.getImageUrl(movieData.poster_path) || '' }}
          style={styles.poster}
          contentFit="cover"
        />
        {showRemove && (
          <Pressable
            style={styles.removeButton}
            onPress={() => handleRemoveFromWatchlist(item.movie_id)}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </Pressable>
        )}
        <Text style={styles.movieTitle} numberOfLines={2}>
          {movieData.title || 'Unknown'}
        </Text>
        {movieData.vote_average && (
          <Text style={styles.rating}>⭐ {movieData.vote_average.toFixed(1)}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{ratedMovies.length}</Text>
          <Text style={styles.statLabel}>Rated</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{likedCount}</Text>
          <Text style={styles.statLabel}>Liked</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{dislikedCount}</Text>
          <Text style={styles.statLabel}>Disliked</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{watchlist.length}</Text>
          <Text style={styles.statLabel}>Watchlist</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push('/onboarding')}
        >
          <Text style={styles.actionButtonText}>Refine Taste</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearData}
        >
          <Text style={styles.actionButtonText}>Clear All Data</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'watchlist' && styles.activeTab]}
          onPress={() => setActiveTab('watchlist')}
        >
          <Text
            style={[styles.tabText, activeTab === 'watchlist' && styles.activeTabText]}
          >
            Watchlist ({watchlist.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'rated' && styles.activeTab]}
          onPress={() => setActiveTab('rated')}
        >
          <Text style={[styles.tabText, activeTab === 'rated' && styles.activeTabText]}>
            Rated ({ratedMovies.length})
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'watchlist' ? (
          watchlist.length > 0 ? (
            <View style={styles.grid}>
              {watchlist.map((item) => renderMovieCard(item, true))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No movies in your watchlist</Text>
              <Text style={styles.emptyHint}>
                Add movies from the detail screen
              </Text>
            </View>
          )
        ) : ratedMovies.length > 0 ? (
          <View style={styles.grid}>
            {ratedMovies.map((item) => renderMovieCard(item, false))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rated movies yet</Text>
            <Text style={styles.emptyHint}>
              Rate movies to get personalized recommendations
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dangerButton: {
    borderColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4caf50',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  movieCard: {
    width: '48%',
    marginBottom: 12,
    position: 'relative',
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  rating: {
    color: '#ffd700',
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginBottom: 8,
  },
  emptyHint: {
    color: '#444',
    fontSize: 14,
  },
});
