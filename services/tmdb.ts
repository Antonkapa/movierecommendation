import axios from 'axios';
import { TMDB_CONFIG } from '@/constants/config';
import type { Movie, MovieDetails, Genre, TMDBResponse } from '@/types/movie';

const api = axios.create({
  baseURL: TMDB_CONFIG.BASE_URL,
  params: {
    api_key: TMDB_CONFIG.API_KEY,
  },
});

export const tmdbService = {
  getPopularMovies: async (page = 1): Promise<TMDBResponse<Movie>> => {
    const response = await api.get('/movie/popular', { params: { page } });
    return response.data;
  },

  getTrendingMovies: async (timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<Movie>> => {
    const response = await api.get(`/trending/movie/${timeWindow}`);
    return response.data;
  },

  getTopRatedMovies: async (page = 1): Promise<TMDBResponse<Movie>> => {
    const response = await api.get('/movie/top_rated', { params: { page } });
    return response.data;
  },

  searchMovies: async (query: string, page = 1): Promise<TMDBResponse<Movie>> => {
    const response = await api.get('/search/movie', {
      params: { query, page },
    });
    return response.data;
  },

  getMovieDetails: async (movieId: number): Promise<MovieDetails> => {
    const response = await api.get(`/movie/${movieId}`, {
      params: {
        append_to_response: 'credits,videos',
      },
    });
    return response.data;
  },

  discoverMovies: async (params: {
    page?: number;
    genre?: number;
    sortBy?: string;
    year?: number;
    minVoteCount?: number;
    minVoteAverage?: number;
  }): Promise<TMDBResponse<Movie>> => {
    const response = await api.get('/discover/movie', {
      params: {
        page: params.page || 1,
        with_genres: params.genre,
        sort_by: params.sortBy || 'popularity.desc',
        primary_release_year: params.year,
        'vote_count.gte': params.minVoteCount,
        'vote_average.gte': params.minVoteAverage,
      },
    });
    return response.data;
  },

  getGenres: async (): Promise<Genre[]> => {
    const response = await api.get('/genre/movie/list');
    return response.data.genres;
  },

  getImageUrl: (path: string | null, size: 'poster' | 'backdrop' | 'profile' = 'poster'): string | null => {
    if (!path) return null;

    const sizeMap = {
      poster: TMDB_CONFIG.POSTER_SIZE,
      backdrop: TMDB_CONFIG.BACKDROP_SIZE,
      profile: TMDB_CONFIG.PROFILE_SIZE,
    };

    return `${TMDB_CONFIG.IMAGE_BASE_URL}/${sizeMap[size]}${path}`;
  },

  getYoutubeUrl: (key: string): string => {
    return `https://www.youtube.com/watch?v=${key}`;
  },
};
