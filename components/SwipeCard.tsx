import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Movie } from '@/types/movie';
import { tmdbService } from '@/services/tmdb';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeCardProps {
  movie: Movie;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function SwipeCard({ movie, onSwipeLeft, onSwipeRight }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        // Swipe detected
        const direction = event.translationX > 0 ? 1 : -1;
        translateX.value = withSpring(direction * SCREEN_WIDTH * 1.5, {}, () => {
          if (direction > 0) {
            runOnJS(onSwipeRight)();
          } else {
            runOnJS(onSwipeLeft)();
          }
        });
      } else {
        // Return to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1]
    );

    return { opacity };
  });

  const nopeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0]
    );

    return { opacity };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image
          source={{ uri: tmdbService.getImageUrl(movie.poster_path, 'backdrop') || '' }}
          style={styles.image}
          contentFit="cover"
        />

        <Animated.View style={[styles.overlay, styles.likeOverlay, likeStyle]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>

        <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeStyle]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>

        <View style={styles.info}>
          <Text style={styles.title}>{movie.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.rating}>⭐ {movie.vote_average.toFixed(1)}</Text>
            <Text style={styles.year}>
              {new Date(movie.release_date).getFullYear()}
            </Text>
          </View>
          <Text style={styles.overview} numberOfLines={4}>
            {movie.overview}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '70%',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    padding: 16,
    borderRadius: 8,
    borderWidth: 4,
  },
  likeOverlay: {
    right: 30,
    borderColor: '#4caf50',
  },
  nopeOverlay: {
    left: 30,
    borderColor: '#f44336',
  },
  likeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  nopeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f44336',
  },
  info: {
    padding: 20,
    flex: 1,
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
    marginBottom: 12,
    gap: 16,
  },
  rating: {
    fontSize: 16,
    color: '#ffd700',
  },
  year: {
    fontSize: 16,
    color: '#999',
  },
  overview: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
});
