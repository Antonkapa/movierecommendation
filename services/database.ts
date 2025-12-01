import { supabase } from '@/lib/supabase';

export interface UserRating {
  id: number;
  movie_id: number;
  rating: number;
  timestamp: number;
  movie_data?: string | any; // Can be string or object depending on Supabase serialization
}

export interface UserPreference {
  id: number;
  genre_id: number;
  weight: number;
}

export const databaseService = {
  initialize: () => {
    // No initialization needed for Supabase
    console.log('Using Supabase database');
  },

  rateMovie: async (movieId: number, rating: number, movieData?: object): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const timestamp = Date.now();

    const { error } = await supabase
      .from('user_ratings')
      .upsert({
        user_id: user.id,
        movie_id: movieId,
        rating,
        timestamp,
        movie_data: movieData || null,
      }, {
        onConflict: 'user_id,movie_id'
      });

    if (error) throw error;
  },

  getMovieRating: async (movieId: number): Promise<number | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .single();

    if (error || !data) return null;
    return data.rating;
  },

  getAllRatings: async (): Promise<UserRating[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error || !data) return [];
    return data;
  },

  getLikedMovies: async (): Promise<UserRating[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('rating', 1)
      .order('timestamp', { ascending: false });

    if (error || !data) return [];
    return data;
  },

  getDislikedMovies: async (): Promise<UserRating[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('rating', -1)
      .order('timestamp', { ascending: false });

    if (error || !data) return [];
    return data;
  },

  updateGenrePreference: async (genreId: number, weight: number): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        genre_id: genreId,
        weight,
      }, {
        onConflict: 'user_id,genre_id'
      });

    if (error) throw error;
  },

  getGenrePreferences: async (): Promise<UserPreference[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('weight', { ascending: false });

    if (error || !data) return [];
    return data;
  },

  getFavoriteGenreIds: async (limit = 5): Promise<number[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_preferences')
      .select('genre_id')
      .eq('user_id', user.id)
      .gt('weight', 0)
      .order('weight', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(p => p.genre_id);
  },

  hasEnoughRatings: async (minRatings = 5): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count, error } = await supabase
      .from('user_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) return false;
    return (count ?? 0) >= minRatings;
  },

  deleteRating: async (movieId: number): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId);

    if (error) throw error;
  },

  clearAllData: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    await Promise.all([
      supabase.from('user_ratings').delete().eq('user_id', user.id),
      supabase.from('user_preferences').delete().eq('user_id', user.id),
      supabase.from('watchlist').delete().eq('user_id', user.id),
    ]);

    console.log('All data cleared');
  },

  // Watchlist functions
  addToWatchlist: async (movieId: number, movieData?: object): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const timestamp = Date.now();

    const { error } = await supabase
      .from('watchlist')
      .upsert({
        user_id: user.id,
        movie_id: movieId,
        timestamp,
        movie_data: movieData || null,
      }, {
        onConflict: 'user_id,movie_id'
      });

    if (error) throw error;
  },

  removeFromWatchlist: async (movieId: number): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId);

    if (error) throw error;
  },

  isInWatchlist: async (movieId: number): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count, error } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('movie_id', movieId);

    if (error) return false;
    return (count ?? 0) > 0;
  },

  getWatchlist: async (): Promise<UserRating[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (error || !data) return [];
    return data;
  },
};
