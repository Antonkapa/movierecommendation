import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { tmdbService } from '@/services/tmdb';
import type { Movie, Genre } from '@/types/movie';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [browseMovies, setBrowseMovies] = useState<Movie[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'genre' | 'trending'>('search');

  useEffect(() => {
    loadGenres();
    loadTrending();
  }, []);

  const loadGenres = async () => {
    try {
      const genreList = await tmdbService.getGenres();
      setGenres(genreList);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  };

  const loadTrending = async () => {
    try {
      setLoading(true);
      const response = await tmdbService.getTrendingMovies('week');
      setBrowseMovies(response.results);
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await tmdbService.searchMovies(query);
      setSearchResults(response.results);
    } catch (error) {
      console.error('Error searching movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = async (genreId: number) => {
    setSelectedGenre(genreId);
    setActiveTab('genre');

    try {
      setLoading(true);
      const response = await tmdbService.discoverMovies({
        genre: genreId,
        sortBy: 'popularity.desc',
      });
      setBrowseMovies(response.results);
    } catch (error) {
      console.error('Error loading genre movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoviePress = (movie: Movie) => {
    router.push(`/movie/${movie.id}`);
  };

  const renderMovieCard = ({ item }: { item: Movie }) => (
    <Pressable style={styles.movieCard} onPress={() => handleMoviePress(item)}>
      <Image
        source={{ uri: tmdbService.getImageUrl(item.poster_path) || '' }}
        style={styles.poster}
        contentFit="cover"
      />
      <View style={styles.movieInfo}>
        <Text style={styles.movieTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.rating}>⭐ {item.vote_average.toFixed(1)}</Text>
        <Text style={styles.year}>
          {item.release_date ? new Date(item.release_date).getFullYear() : 'N/A'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'genre' && styles.activeTab]}
          onPress={() => setActiveTab('genre')}
        >
          <Text style={[styles.tabText, activeTab === 'genre' && styles.activeTabText]}>
            Genres
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
          onPress={() => {
            setActiveTab('trending');
            loadTrending();
          }}
        >
          <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
            Trending
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === 'search' && (
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" style={styles.loader} />
          ) : searchQuery.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMovieCard}
              numColumns={2}
              contentContainerStyle={styles.grid}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results found</Text>
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Search for movies by title</Text>
            </View>
          )}
        </View>
      )}

      {activeTab === 'genre' && (
        <View style={styles.content}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreList}>
            {genres.map((genre) => (
              <Pressable
                key={genre.id}
                style={[
                  styles.genreChip,
                  selectedGenre === genre.id && styles.genreChipActive,
                ]}
                onPress={() => handleGenreSelect(genre.id)}
              >
                <Text
                  style={[
                    styles.genreChipText,
                    selectedGenre === genre.id && styles.genreChipTextActive,
                  ]}
                >
                  {genre.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator size="large" color="#fff" style={styles.loader} />
          ) : (
            <FlatList
              data={browseMovies}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMovieCard}
              numColumns={2}
              contentContainerStyle={styles.grid}
            />
          )}
        </View>
      )}

      {activeTab === 'trending' && (
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" style={styles.loader} />
          ) : (
            <FlatList
              data={browseMovies}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMovieCard}
              numColumns={2}
              contentContainerStyle={styles.grid}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
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
    flex: 1,
  },
  genreList: {
    marginBottom: 16,
    paddingHorizontal: 16,
    maxHeight: 50,
  },
  genreChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  genreChipActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  genreChipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  genreChipTextActive: {
    color: '#fff',
  },
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  movieCard: {
    flex: 1,
    margin: 8,
    maxWidth: '45%',
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  movieInfo: {
    marginTop: 8,
  },
  movieTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  rating: {
    color: '#ffd700',
    fontSize: 12,
    marginBottom: 2,
  },
  year: {
    color: '#999',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  loader: {
    marginTop: 40,
  },
});
