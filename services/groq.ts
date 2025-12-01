import axios from 'axios';
import { databaseService } from './database';
import { tmdbService } from './tmdb';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

    const likedTitles = likedMovies
      .map((r) => {
        const data = r.movie_data
          ? typeof r.movie_data === 'string'
            ? JSON.parse(r.movie_data)
            : r.movie_data
          : {};
        return data.title;
      })
      .filter(Boolean)
      .slice(0, 10);

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

    return `You are a movie recommendation assistant. Here's what you know about the user:

Movies they liked: ${likedTitles.join(', ') || 'None yet'}
Movies they disliked: ${dislikedTitles.join(', ') || 'None yet'}
Total movies rated: ${ratings.length}
Favorite genre IDs: ${favoriteGenres.join(', ') || 'None yet'}

Based on this information, provide personalized movie recommendations and chat naturally about movies.
When recommending movies, use the search_movies function to get real movie data.
Be conversational, enthusiastic, and helpful!`;
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
