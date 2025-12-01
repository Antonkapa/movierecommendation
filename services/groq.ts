import axios from 'axios';
import { databaseService } from './database';
import { tmdbService } from './tmdb';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Genre ID to name mapping
const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TasteProfile {
  favoriteKeywords: Map<string, number>;
  favoriteDirectors: Map<string, number>;
  favoriteActors: Map<string, number>;
  favoriteStudios: Map<string, number>;
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

export const groqService = {
  /**
   * Build user context from their movie preferences
   */
  buildUserContext: async (): Promise<string> => {
    const [ratings, likedMovies, dislikedMovies, favoriteGenres] = await Promise.all([
      databaseService.getAllRatings(),
      databaseService.getLikedMovies(),
      databaseService.getDislikedMovies(),
      databaseService.getFavoriteGenreIds(5),
    ]);

    // Build taste profile for deeper insights
    const tasteProfile = buildTasteProfile(ratings);

    // Get liked movie titles with years
    const likedTitles = likedMovies
      .map((r) => {
        const data = r.movie_data
          ? typeof r.movie_data === 'string'
            ? JSON.parse(r.movie_data)
            : r.movie_data
          : {};
        const year = data.release_date ? new Date(data.release_date).getFullYear() : '';
        return data.title ? `${data.title}${year ? ` (${year})` : ''}` : null;
      })
      .filter(Boolean)
      .slice(0, 10);

    // Get disliked movie titles
    const dislikedTitles = dislikedMovies
      .map((r) => {
        const data = r.movie_data
          ? typeof r.movie_data === 'string'
            ? JSON.parse(r.movie_data)
            : r.movie_data
          : {};
        return data.title;
      })
      .filter(Boolean)
      .slice(0, 5);

    // Convert genre IDs to names
    const favoriteGenreNames = favoriteGenres
      .map(id => GENRE_NAMES[id])
      .filter(Boolean);

    // Extract top preferences from taste profile
    const topKeywords = Array.from(tasteProfile.favoriteKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword]) => keyword);

    const topDirectors = Array.from(tasteProfile.favoriteDirectors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([director]) => director);

    const topActors = Array.from(tasteProfile.favoriteActors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([actor]) => actor);

    const topStudios = Array.from(tasteProfile.favoriteStudios.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([studio]) => studio);

    // Calculate quality preferences
    const likedMovieRatings = likedMovies
      .map(r => {
        const data = r.movie_data
          ? typeof r.movie_data === 'string'
            ? JSON.parse(r.movie_data)
            : r.movie_data
          : {};
        return data.vote_average || 0;
      })
      .filter(rating => rating > 0);

    const avgRatingPreference = likedMovieRatings.length > 0
      ? (likedMovieRatings.reduce((sum, r) => sum + r, 0) / likedMovieRatings.length).toFixed(1)
      : 'N/A';

    // Calculate age preferences
    const likedMovieYears = likedMovies
      .map(r => {
        const data = r.movie_data
          ? typeof r.movie_data === 'string'
            ? JSON.parse(r.movie_data)
            : r.movie_data
          : {};
        return data.release_date ? new Date(data.release_date).getFullYear() : 0;
      })
      .filter(year => year > 0);

    const currentYear = new Date().getFullYear();
    const recentMovies = likedMovieYears.filter(year => currentYear - year <= 5).length;
    const classicMovies = likedMovieYears.filter(year => currentYear - year > 20).length;

    let agePreference = 'No clear preference yet';
    if (likedMovieYears.length > 3) {
      if (recentMovies > likedMovieYears.length * 0.6) {
        agePreference = 'Prefers recent releases';
      } else if (classicMovies > likedMovieYears.length * 0.4) {
        agePreference = 'Enjoys classics and older films';
      } else {
        agePreference = 'Enjoys a mix of old and new';
      }
    }

    // Build comprehensive context
    let context = `You are a movie recommendation assistant with deep knowledge of the user's taste. Here's their detailed profile:

📊 RATING STATS:
- Total movies rated: ${ratings.length}
- Liked: ${likedMovies.length} | Disliked: ${dislikedMovies.length}
- Average rating of liked movies: ${avgRatingPreference}/10
- Age preference: ${agePreference}

🎬 FAVORITE GENRES:
${favoriteGenreNames.length > 0 ? favoriteGenreNames.join(', ') : 'None yet - still learning their taste'}

❤️ MOVIES THEY LOVED:
${likedTitles.length > 0 ? likedTitles.join(', ') : 'None yet'}

👎 MOVIES THEY DISLIKED:
${dislikedTitles.length > 0 ? dislikedTitles.join(', ') : 'None yet'}`;

    // Add taste profile details if available
    if (topDirectors.length > 0) {
      context += `\n\n🎥 FAVORITE DIRECTORS:\n${topDirectors.join(', ')}`;
    }

    if (topActors.length > 0) {
      context += `\n\n⭐ FAVORITE ACTORS:\n${topActors.join(', ')}`;
    }

    if (topStudios.length > 0) {
      context += `\n\n🏢 FAVORITE STUDIOS:\n${topStudios.join(', ')}`;
    }

    if (topKeywords.length > 0) {
      context += `\n\n🔑 THEMES & KEYWORDS THEY ENJOY:\n${topKeywords.join(', ')}`;
    }

    context += `\n\n## RESPONSE FORMATTING INSTRUCTIONS:

When recommending movies, format them as CLICKABLE LINKS exactly like this:

**[Inception (2010)](movie:Inception)** - Brief one-line reason why it matches their taste

CRITICAL EXAMPLES - COPY THIS EXACT FORMAT:
**[Inception (2010)](movie:Inception)** - Mind-bending sci-fi from Nolan
**[Blade Runner 2049 (2017)](movie:Blade Runner 2049)** - Villeneuve's dystopian masterpiece
**[The Matrix (1999)](movie:The Matrix)** - Revolutionary sci-fi you'll love

IMPORTANT FORMAT RULES:
- Start with ** (two asterisks)
- Then the link: [Title (Year)](movie:Title)
- Then ** (two asterisks)
- Format is: **[Title (Year)](movie:Title)** - reason
- The movie: part must be the movie name without the year
- Keep reasons to ONE line maximum
- Group recommendations with clear headers (## Recommendations)
- Use bullet points or numbered lists for multiple movies
- Reference their favorite directors, actors, or themes when relevant

Movie titles are CLICKABLE - users can tap them to see full details!`;

    return context;
  },

  /**
   * Chat with Groq AI
   */
  chat: async (messages: Message[]): Promise<string> => {
    try {
      const systemMessage = await groqService.buildUserContext();

      const response = await axios.post(
        GROQ_API_URL,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemMessage },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  },

  /**
   * Search movies and format for AI response
   */
  searchMoviesForAI: async (query: string): Promise<string> => {
    try {
      const response = await tmdbService.searchMovies(query);
      const movies = response.results.slice(0, 5);

      if (movies.length === 0) {
        return `No movies found for "${query}"`;
      }

      return movies
        .map(
          (movie, index) =>
            `${index + 1}. ${movie.title} (${new Date(movie.release_date).getFullYear()}) - Rating: ${movie.vote_average.toFixed(1)}/10`
        )
        .join('\n');
    } catch (error) {
      console.error('Error searching movies:', error);
      return 'Failed to search movies';
    }
  },
};
