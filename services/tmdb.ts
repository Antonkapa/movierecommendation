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
        append_to_response: 'credits,videos,keywords',
      },
    });
    return response.data;
  },

  getMovieKeywords: async (movieId: number): Promise<any> => {
    const response = await api.get(`/movie/${movieId}/keywords`);
    return response.data.keywords || [];
  },

  discoverMovies: async (params: {
    page?: number;
    genre?: number;
    sortBy?: string;
    year?: number;
    minVoteCount?: number;
    minVoteAverage?: number;
    keywords?: number[]; // Keyword IDs
    cast?: number[]; // Actor IDs
    crew?: number[]; // Crew member IDs (e.g., director)
    companies?: number[]; // Production company IDs
  }): Promise<TMDBResponse<Movie>> => {
    const response = await api.get('/discover/movie', {
      params: {
        page: params.page || 1,
        with_genres: params.genre,
        sort_by: params.sortBy || 'popularity.desc',
        primary_release_year: params.year,
        'vote_count.gte': params.minVoteCount,
        'vote_average.gte': params.minVoteAverage,
        with_keywords: params.keywords?.join(','),
        with_cast: params.cast?.join(','),
        with_crew: params.crew?.join(','),
        with_companies: params.companies?.join(','),
      },
    });
    return response.data;
  },

  searchKeyword: async (query: string): Promise<any> => {
    const response = await api.get('/search/keyword', {
      params: { query },
    });
    return response.data.results || [];
  },

  searchPerson: async (query: string): Promise<any> => {
    const response = await api.get('/search/person', {
      params: { query },
    });
    return response.data.results || [];
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
