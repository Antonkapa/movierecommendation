import { Text, View, FlatList, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { tmdbService } from "@/services/tmdb";
import { databaseService } from "@/services/database";
import { recommendationService } from "@/services/recommendations";
import type { Movie } from "@/types/movie";

export default function Index() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Small delay to ensure layout is mounted
    const timer = setTimeout(() => {
      checkOnboarding();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const checkOnboarding = async () => {
    // Check if user needs onboarding
    const hasEnough = await databaseService.hasEnoughRatings(10);
    if (!hasEnough) {
      router.replace('/onboarding');
      return;
    }
    loadMovies();
  };

  const loadMovies = async () => {
    try {
      setLoading(true);
      setError(null);
      const recommendations = await recommendationService.getRecommendations();
      setMovies(recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load movies");
      console.error("Error loading movies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoviePress = (movie: Movie) => {
    router.push(`/movie/${movie.id}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Text style={styles.errorHint}>
          Make sure you've added your TMDB API key to the .env file
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recommended for You</Text>
      </View>
      <Pressable
        onPress={() => {
          router.push('/onboarding');
        }}
        style={styles.refineButtonContainer}
      >
        <Text style={styles.refineButton}>+ Rate More</Text>
      </Pressable>
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable
            style={styles.movieCard}
            onPress={() => handleMoviePress(item)}
          >
            <Image
              source={{ uri: tmdbService.getImageUrl(item.poster_path) || "" }}
              style={styles.poster}
              contentFit="cover"
            />
            <View style={styles.movieInfo}>
              <Text style={styles.movieTitle}>{item.title}</Text>
              <Text style={styles.rating}>⭐ {item.vote_average.toFixed(1)}</Text>
              <Text style={styles.overview} numberOfLines={3}>
                {item.overview}
              </Text>
            </View>
          </Pressable>
        )}
        refreshing={loading}
        onRefresh={loadMovies}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  refineButtonContainer: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4caf50",
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  refineButton: {
    fontSize: 14,
    color: "#4caf50",
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 12,
    color: "#999",
    fontSize: 16,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    marginBottom: 8,
  },
  errorHint: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  movieCard: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  poster: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  movieInfo: {
    flex: 1,
    marginLeft: 12,
  },
  movieTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    color: "#ffd700",
    marginBottom: 8,
  },
  overview: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
});
