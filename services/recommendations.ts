import { databaseService } from './database';
import { tmdbService } from './tmdb';
import type { Movie, MovieWithMatch, MatchBreakdown } from '@/types/movie';

// Genre ID to name mapping
const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

export const recommendationService = {
  /**
   * Get personalized movie recommendations based on user's ratings
   */
  getRecommendations: async (page = 1): Promise<MovieWithMatch[]> => {
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

      // Diverse fetching strategy: mix of sort methods, years, and pages
      const currentYear = new Date().getFullYear();
      const yearRanges = [
        { min: currentYear - 2, max: currentYear }, // Recent (last 2 years)
        { min: currentYear - 10, max: currentYear - 3 }, // Recent past (3-10 years ago)
        { min: 1990, max: currentYear - 11 }, // Classics (1990+)
        { min: 1970, max: 1989 }, // Older classics
      ];

      const sortMethods = [
        'popularity.desc',
        'vote_average.desc',
        'vote_count.desc',
        'primary_release_date.desc',
      ];

      const genreMoviesPromises: Promise<any>[] = [];

      // Fetch multiple pages and year ranges for each genre
      favoriteGenres.forEach((genreId, genreIndex) => {
        // Vary page number based on input page to get different results
        const basePage = Math.floor((page - 1) / favoriteGenres.length) + 1;
        const pageOffset = (page - 1) % favoriteGenres.length;
        const fetchPage = basePage + (genreIndex === pageOffset ? 1 : 0);

        // Mix of year ranges (60% recent, 20% past, 15% classics, 5% old classics)
        const yearRangeIndex =
          Math.random() < 0.6 ? 0 :
          Math.random() < 0.75 ? 1 :
          Math.random() < 0.9 ? 2 : 3;

        const yearRange = yearRanges[yearRangeIndex];
        const sortBy = sortMethods[genreIndex % sortMethods.length];

        // Fetch from different year ranges for diversity
        genreMoviesPromises.push(
          tmdbService.discoverMovies({
            genre: genreId,
            page: fetchPage,
            sortBy,
            minVoteCount: yearRange.min < 2000 ? 50 : 100, // Lower threshold for older movies
            minVoteAverage: 5.5, // Slightly lower to include more variety
          })
        );

        // Also fetch a random year from the range for extra variety
        if (Math.random() < 0.5) {
          const randomYear = Math.floor(Math.random() * (yearRange.max - yearRange.min + 1)) + yearRange.min;
          genreMoviesPromises.push(
            tmdbService.discoverMovies({
              genre: genreId,
              page: 1,
              year: randomYear,
              sortBy: 'vote_average.desc',
              minVoteCount: 30,
              minVoteAverage: 6.5,
            })
          );
        }
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

      // Get liked movies for match breakdown
      const likedMovies = ratedMovies.filter(r => r.rating === 1);

      // Build taste profile from rated movies
      const tasteProfile = buildTasteProfile(ratedMovies);

      // Score movies based on comprehensive matching
      const scoredMovies = unratedMovies.map(movie => {
        const scoreData = calculateMovieScore(movie, favoriteGenres, ratedMovies, tasteProfile);
        return {
          movie,
          score: scoreData.score,
          rawScoreData: scoreData,
        };
      });

      // Sort by score with some randomization to prevent identical results
      scoredMovies.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        // Add small random factor if scores are close (within 10%)
        if (Math.abs(scoreDiff) < b.score * 0.1) {
          return Math.random() - 0.5;
        }
        return scoreDiff;
      });

      // Find max score for percentage normalization
      const maxScore = scoredMovies[0]?.score || 1;
      const minScore = scoredMovies[scoredMovies.length - 1]?.score || 0;
      const scoreRange = maxScore - minScore || 1;

      // Return varied slice based on page
      const startIndex = ((page - 1) % 3) * 7; // Offset to show different movies
      const endIndex = startIndex + 20;
      const selectedMovies = scoredMovies.slice(startIndex, endIndex);

      // If we don't have enough, pad with the rest
      if (selectedMovies.length < 20) {
        const additionalMovies = scoredMovies
          .slice(endIndex)
          .slice(0, 20 - selectedMovies.length);
        selectedMovies.push(...additionalMovies);
      }

      // Add match scores to movies
      const results: MovieWithMatch[] = selectedMovies.map(item => {
        const normalizedScore = ((item.score - minScore) / scoreRange) * 100;
        const percentage = Math.max(50, Math.min(99, normalizedScore)); // Clamp between 50-99%

        const matchBreakdown = createMatchBreakdown(
          item.movie,
          percentage,
          item.rawScoreData,
          favoriteGenres,
          likedMovies.length
        );

        return {
          ...item.movie,
          matchScore: matchBreakdown,
        };
      });

      return results;
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
      const movieData = recentLiked.movie_data
        ? typeof recentLiked.movie_data === 'string'
          ? JSON.parse(recentLiked.movie_data)
          : recentLiked.movie_data
        : {};

      return [];
    } catch (error) {
      console.error('Error getting similar movies:', error);
      return [];
    }
  },
};

interface TasteProfile {
  favoriteKeywords: Map<string, number>; // keyword -> count
  favoriteDirectors: Map<string, number>; // director -> count
  favoriteActors: Map<string, number>; // actor -> count
  favoriteStudios: Map<string, number>; // studio -> count
}

/**
 * Build a taste profile from user's rated movies
 */
function buildTasteProfile(ratedMovies: any[]): TasteProfile {
  const profile: TasteProfile = {
    favoriteKeywords: new Map(),
    favoriteDirectors: new Map(),
    favoriteActors: new Map(),
    favoriteStudios: new Map(),
  };

  const likedMovies = ratedMovies.filter(r => r.rating === 1);

  for (const movie of likedMovies) {
    const data = movie.movie_data
      ? typeof movie.movie_data === 'string'
        ? JSON.parse(movie.movie_data)
        : movie.movie_data
      : {};

    // Count keywords
    if (data.keywords && Array.isArray(data.keywords)) {
      for (const keyword of data.keywords) {
        const count = profile.favoriteKeywords.get(keyword) || 0;
        profile.favoriteKeywords.set(keyword, count + 1);
      }
    }

    // Count directors
    if (data.director) {
      const count = profile.favoriteDirectors.get(data.director) || 0;
      profile.favoriteDirectors.set(data.director, count + 1);
    }

    // Count actors
    if (data.actors && Array.isArray(data.actors)) {
      for (const actor of data.actors) {
        const count = profile.favoriteActors.get(actor) || 0;
        profile.favoriteActors.set(actor, count + 1);
      }
    }

    // Count studios
    if (data.production_company) {
      const count = profile.favoriteStudios.get(data.production_company) || 0;
      profile.favoriteStudios.set(data.production_company, count + 1);
    }
  }

  return profile;
}

/**
 * Calculate a score for a movie based on comprehensive taste matching
 */
function calculateMovieScore(
  movie: Movie,
  favoriteGenres: number[],
  ratedMovies: any[],
  tasteProfile: TasteProfile
): {
  score: number;
  genreMatchCount: number;
  ageCategory: string;
  qualityScore: number;
  keywordMatches: string[];
  directorMatch: string | null;
  actorMatches: string[];
  studioMatch: string | null;
} {
  let score = 0;

  // Genre matching is most important (heavily weight personalization)
  const genreMatches = movie.genre_ids.filter(id => favoriteGenres.includes(id));
  const genreMatchCount = genreMatches.length;
  score += genreMatchCount * 100; // Increased from 50 to 100

  // Quality score (TMDB rating) - moderate weight
  const qualityScore = movie.vote_average * 15;
  score += qualityScore;

  // Reliability bonus (vote count) - ensure it's not too obscure
  const voteCountScore = Math.min(Math.log(movie.vote_count + 1) * 3, 30); // Cap at 30
  score += voteCountScore;

  // Popularity - reduced weight to prevent new movie bias
  const popularityScore = Math.min(Math.log(movie.popularity + 1) * 2, 20); // Reduced and capped
  score += popularityScore;

  // Age diversity bonus - favor a mix of old and new
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const movieAge = currentYear - releaseYear;

  let ageCategory = 'Recent';
  let ageBonus = 0;

  // Slightly favor older movies to counteract recency bias
  if (movieAge > 40) {
    ageCategory = 'Classic';
    ageBonus = 20;
  } else if (movieAge > 10 && movieAge < 40) {
    ageCategory = 'Modern Classic';
    ageBonus = 15;
  } else if (movieAge > 5 && movieAge <= 10) {
    ageCategory = 'Recent Hit';
    ageBonus = 10;
  }
  score += ageBonus;

  // Penalty for movies similar to disliked ones
  const dislikedMovies = ratedMovies.filter(r => r.rating === -1);
  for (const disliked of dislikedMovies) {
    const dislikedData = disliked.movie_data
      ? typeof disliked.movie_data === 'string'
        ? JSON.parse(disliked.movie_data)
        : disliked.movie_data
      : {};

    // If this movie shares genres with disliked movies, penalize it
    if (dislikedData.genre_ids) {
      const sharedGenres = movie.genre_ids.filter(
        (id: number) => dislikedData.genre_ids?.includes(id)
      );
      score -= sharedGenres.length * 15; // Penalty for shared genres with dislikes
    }
  }

  return { score, genreMatchCount, ageCategory, qualityScore };
}

/**
 * Create a detailed match breakdown for display
 */
function createMatchBreakdown(
  movie: Movie,
  percentage: number,
  scoreData: { genreMatchCount: number; ageCategory: string; qualityScore: number },
  favoriteGenres: number[],
  totalLikedMovies: number
): MatchBreakdown {
  const matchedGenreIds = movie.genre_ids.filter(id => favoriteGenres.includes(id));
  const genreMatchNames = matchedGenreIds.map(id => GENRE_NAMES[id] || 'Unknown');

  const reasons: string[] = [];

  // Add reasons based on scoring
  if (scoreData.genreMatchCount > 0) {
    reasons.push(`Matches ${scoreData.genreMatchCount} of your favorite genres`);
  }

  if (movie.vote_average >= 7.5) {
    reasons.push(`Highly rated (${movie.vote_average.toFixed(1)}/10)`);
  }

  if (scoreData.ageCategory !== 'Recent') {
    reasons.push(`${scoreData.ageCategory} film`);
  }

  if (totalLikedMovies > 5 && scoreData.genreMatchCount >= 2) {
    reasons.push('Strong genre alignment with your taste');
  }

  return {
    percentage: Math.round(percentage),
    genreMatches: scoreData.genreMatchCount,
    genreMatchNames,
    qualityScore: movie.vote_average,
    ageCategory: scoreData.ageCategory,
    totalLikedMovies,
    reasons: reasons.length > 0 ? reasons : ['Recommended based on your preferences'],
  };
}
