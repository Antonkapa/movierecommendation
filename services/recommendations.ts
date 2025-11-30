import { databaseService } from './database';
import { tmdbService } from './tmdb';
import type { Movie } from '@/types/movie';

export const recommendationService = {
  /**
   * Get personalized movie recommendations based on user's ratings
   */
  getRecommendations: async (page = 1): Promise<Movie[]> => {
    try {
      // Get user's favorite genres
      const favoriteGenres = await databaseService.getFavoriteGenreIds(5);

      if (favoriteGenres.length === 0) {
        // No preferences yet, return popular movies
        const response = await tmdbService.getPopularMovies(page);
        return response.results;
      }

      // Get user's rated movie IDs to exclude them
      const ratedMovies = await databaseService.getAllRatings();
      const ratedMovieIds = new Set(ratedMovies.map(r => r.movie_id));

      // Fetch movies for each favorite genre with varied sorting to get diverse results
      const sortMethods = ['popularity.desc', 'vote_average.desc', 'vote_count.desc'];
      const genreMoviesPromises: Promise<any>[] = [];

      favoriteGenres.forEach((genreId, index) => {
        // Use different sort methods for variety
        const sortBy = sortMethods[index % sortMethods.length];

        genreMoviesPromises.push(
          tmdbService.discoverMovies({
            genre: genreId,
            page: 1,
            sortBy,
            minVoteCount: 100, // Filter out obscure movies
            minVoteAverage: 6.0, // Only recommend decent movies
          })
        );
      });

      const genreMoviesResults = await Promise.all(genreMoviesPromises);

      // Combine all movies and remove duplicates and rated movies
      const allMovies = genreMoviesResults.flatMap(result => result.results);
      const uniqueMovies = Array.from(
        new Map(allMovies.map(movie => [movie.id, movie])).values()
      );

      // Filter out already rated movies
      const unratedMovies = uniqueMovies.filter(
        movie => !ratedMovieIds.has(movie.id)
      );

      // Score movies based on genre overlap with user preferences
      const scoredMovies = unratedMovies.map(movie => ({
        movie,
        score: calculateMovieScore(movie, favoriteGenres),
      }));

      // Sort by score and return top results
      scoredMovies.sort((a, b) => b.score - a.score);

      return scoredMovies.slice(0, 20).map(item => item.movie);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      // Fallback to popular movies
      const response = await tmdbService.getPopularMovies(page);
      return response.results;
    }
  },

  /**
   * Get similar movies to ones the user liked
   */
  getSimilarToLiked: async (): Promise<Movie[]> => {
    try {
      const likedMovies = await databaseService.getLikedMovies();

      if (likedMovies.length === 0) {
        return [];
      }

      // Get the most recently liked movie
      const recentLiked = likedMovies[0];

      // In a real app, you'd use TMDB's /movie/{id}/similar endpoint
      // For now, we'll just get movies with similar genres
      const movieData = JSON.parse(recentLiked.movie_data || '{}');

      return [];
    } catch (error) {
      console.error('Error getting similar movies:', error);
      return [];
    }
  },
};

/**
 * Calculate a score for a movie based on genre overlap with user preferences
 */
function calculateMovieScore(movie: Movie, favoriteGenres: number[]): number {
  let score = 0;

  // Base score from TMDB rating
  score += movie.vote_average * 10;

  // Bonus points for each matching genre
  const genreMatches = movie.genre_ids.filter(id => favoriteGenres.includes(id));
  score += genreMatches.length * 50;

  // Bonus for popularity (but weighted less than genre match)
  score += Math.log(movie.popularity) * 5;

  // Bonus for higher vote count (more reliable ratings)
  score += Math.log(movie.vote_count + 1) * 2;

  return score;
}
