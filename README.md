# 🎬 Movie Recommendation App

An AI powered personalized movie recommendation mobile app built with Expo and React Native. Discover movies tailored to your taste through smart recommendations, interactive rating, and **intelligent** search.

## Features

### 🎯 Personalized Recommendations
- **Smart Recommendations**: Get movie suggestions based on your rating history and genre preferences
- **Onboarding Flow**: Swipe through movies to rate them and build your taste profile (minimum 10 ratings required)

### 🔍 Search & Discovery
- **Movie Search**: Search for movies by title with real-time results
- **Genre Browsing**: Browse movies by genre categories
- **Movie Details**: View comprehensive movie information including ratings, overview, and cast

### 💬 AI Chat Assistant
- **Personalized Movie Chat**: Chat with an AI assistant powered by Groq that understands your movie preferences
- **Context-Aware Recommendations**: Get suggestions based on your mood and past ratings
- **Natural Language Interaction**: Ask questions about movies in natural language

### 👤 User Profile
- **Watchlist**: Save movies you want to watch later
- **Rating History**: View all movies you've liked and disliked
- **Statistics**: Track your rating activity

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) with React Native
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Authentication**: [Supabase](https://supabase.com)
- **Movie Data**: [The Movie Database (TMDB) API](https://www.themoviedb.org/documentation/api)
- **AI Chat**: [Groq API](https://groq.com)
- **Local Storage**: SQLite (via Expo SQLite)
- **UI Components**: React Native with custom components
- **State Management**: React Context API

## 📱 Screens

- **Home/For You** (`app/(tabs)/index.tsx`): Personalized movie recommendations
- **Search** (`app/(tabs)/search.tsx`): Search, browse by genre, and view trending movies
- **Chat** (`app/(tabs)/chat.tsx`): AI-powered movie recommendation chat
- **Profile** (`app/(tabs)/profile.tsx`): User profile with watchlist and rating history
- **Onboarding** (`app/onboarding.tsx`): Swipe-to-rate interface for building taste profile
- **Auth** (`app/auth.tsx`): Login and signup screen
- **Movie Detail** (`app/movie/[id].tsx`): Detailed movie information page

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Emulator
- API keys for:
  - [TMDB](https://www.themoviedb.org/settings/api)
  - [Supabase](https://supabase.com)
  - [Groq](https://groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Antonkapa/movierecommendation.git
   cd movie-recommendation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
   ```

   See `.env.example` for reference.

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on your device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your physical device

## 🔧 Key Services

### Database Service (`services/database.ts`)
- Manages local SQLite database
- Handles user ratings, watchlist, and preferences
- Tracks favorite genres based on ratings

### TMDB Service (`services/tmdb.ts`)
- Fetches movie data from TMDB API
- Handles search, trending, and genre filtering
- Provides movie images and metadata

### Recommendation Service (`services/recommendations.ts`)
- Generates personalized recommendations
- Scores movies based on genre preferences
- Filters out already-rated movies

### Groq Service (`services/groq.ts`)
- Integrates with Groq AI for chat functionality
- Provides context-aware movie recommendations

## 🎨 Features in Detail

### Onboarding Flow
Users must rate at least 10 movies before accessing recommendations. The onboarding screen uses a swipeable card interface where users can:
- Swipe right to like a movie
- Swipe left to dislike a movie
- View movie details before rating

### Recommendation Algorithm
The app uses a scoring system that considers:
- Genre overlap with user preferences
- TMDB rating and popularity
- Vote count (reliability indicator)
- Excludes already-rated movies

### Watchlist
Users can save movies to their watchlist from the movie detail page and manage them from the profile screen.

## 📦 Building for Production

### Development Build
```bash
npm run development-builds
```

### Production Build
```bash
npx eas-cli@latest build --platform ios
npx eas-cli@latest build --platform android
```

### Deploy
```bash
npm run deploy
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the 0BSD License.

## 🙏 Acknowledgments

- [The Movie Database (TMDB)](https://www.themoviedb.org/) for movie data
- [Supabase](https://supabase.com) for authentication
- [Groq](https://groq.com) for AI chat capabilities
- [Expo](https://expo.dev) for the amazing development platform


