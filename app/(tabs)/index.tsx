import { Text, View, FlatList, ActivityIndicator, StyleSheet, Pressable, Modal } from "react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { tmdbService } from "@/services/tmdb";
import { databaseService } from "@/services/database";
import { recommendationService } from "@/services/recommendations";
import type { MovieWithMatch, MatchBreakdown } from "@/types/movie";

export default function Index() {
  const [movies, setMovies] = useState<MovieWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

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
      // Use random page number (1-5) to get different recommendations each time
      const randomPage = Math.floor(Math.random() * 5) + 1;
      const recommendations = await recommendationService.getRecommendations(randomPage);
      setMovies(recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load movies");
      console.error("Error loading movies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoviePress = (movieId: number) => {
    router.push(`/movie/${movieId}`);
  };

  const handleMatchPress = (match: MatchBreakdown) => {
    setSelectedMatch(match);
    setShowBreakdown(true);
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return '#4caf50'; // Green
    if (percentage >= 75) return '#8bc34a'; // Light green
    if (percentage >= 60) return '#ffc107'; // Yellow
    return '#ff9800'; // Orange
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
        <Text style={styles.subtitle}>
          Personalized picks from your favorite genres
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => router.push('/onboarding')}
          style={[styles.actionButton, styles.rateButton]}
        >
          <Text style={styles.actionButtonText}>+ Rate More</Text>
        </Pressable>
        <Pressable
          onPress={loadMovies}
          style={[styles.actionButton, styles.refreshButton]}
        >
          <Text style={styles.actionButtonText}>🔄 Refresh</Text>
        </Pressable>
      </View>
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.movieCard}>
            <Pressable
              style={styles.movieContent}
              onPress={() => handleMoviePress(item.id)}
            >
              <Image
                source={{ uri: tmdbService.getImageUrl(item.poster_path) || "" }}
                style={styles.poster}
                contentFit="cover"
              />
              <View style={styles.movieInfo}>
                <Text style={styles.movieTitle}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.rating}>⭐ {item.vote_average.toFixed(1)}</Text>
                  {item.matchScore && (
                    <Pressable
                      style={[
                        styles.matchBadge,
                        { borderColor: getMatchColor(item.matchScore.percentage) },
                      ]}
                      onPress={() => handleMatchPress(item.matchScore!)}
                    >
                      <Text
                        style={[
                          styles.matchText,
                          { color: getMatchColor(item.matchScore.percentage) },
                        ]}
                      >
                        {item.matchScore.percentage}% Match
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.overview} numberOfLines={3}>
                  {item.overview}
                </Text>
              </View>
            </Pressable>
          </View>
        )}
        refreshing={loading}
        onRefresh={loadMovies}
      />

      {/* Match Breakdown Modal */}
      <Modal
        visible={showBreakdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBreakdown(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBreakdown(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedMatch && (
              <>
                <View style={styles.modalHeader}>
                  <Text
                    style={[
                      styles.modalPercentage,
                      { color: getMatchColor(selectedMatch.percentage) },
                    ]}
                  >
                    {selectedMatch.percentage}% Match
                  </Text>
                  <Pressable onPress={() => setShowBreakdown(false)}>
                    <Text style={styles.closeButton}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Why this match?</Text>
                  {selectedMatch.reasons.map((reason, index) => (
                    <View key={index} style={styles.reasonItem}>
                      <Text style={styles.reasonBullet}>•</Text>
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>

                {selectedMatch.genreMatchNames.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Matching Genres</Text>
                    <View style={styles.genreList}>
                      {selectedMatch.genreMatchNames.map((genre, index) => (
                        <View key={index} style={styles.genreChip}>
                          <Text style={styles.genreChipText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Details</Text>
                  <Text style={styles.detailText}>
                    Category: {selectedMatch.ageCategory}
                  </Text>
                  <Text style={styles.detailText}>
                    Rating: {selectedMatch.qualityScore.toFixed(1)}/10
                  </Text>
                  <Text style={styles.detailText}>
                    Based on {selectedMatch.totalLikedMovies} movies you liked
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  rateButton: {
    backgroundColor: "#1a1a1a",
    borderColor: "#4caf50",
  },
  refreshButton: {
    backgroundColor: "#1a1a1a",
    borderColor: "#666",
  },
  actionButtonText: {
    fontSize: 14,
    color: "#fff",
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
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  movieContent: {
    flexDirection: "row",
    padding: 16,
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
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  rating: {
    fontSize: 14,
    color: "#ffd700",
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  matchText: {
    fontSize: 12,
    fontWeight: "700",
  },
  overview: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalPercentage: {
    fontSize: 28,
    fontWeight: "bold",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
    padding: 4,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 4,
  },
  reasonBullet: {
    color: "#4caf50",
    fontSize: 16,
    marginRight: 8,
    fontWeight: "bold",
  },
  reasonText: {
    flex: 1,
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
  },
  genreList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4caf50",
  },
  genreChipText: {
    color: "#4caf50",
    fontSize: 13,
    fontWeight: "600",
  },
  detailText: {
    color: "#999",
    fontSize: 14,
    marginBottom: 6,
  },
});
