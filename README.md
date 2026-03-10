# GymHero - Fitness Workout Tracking App

A full-stack web application for tracking and sharing gym workouts.

## What is this?

GymHero allows users to:

- Share workout photos and videos
- Track workout streaks (consecutive days)
- View personal workout statistics
- Browse other users' workout posts

## Technology Stack

**Backend:**

- Node.js + Express (TypeScript)
- SQLite database
- JWT authentication
- Multer for file uploads

**Frontend:**

- React 18 (TypeScript)
- Tailwind CSS
- React Router
- Axios

## Getting Started

### 1. Backend Setup

```bash
# Navigate to backend folder
cd gymhero

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start the backend server
npm run dev
```

Backend will run on: `http://localhost:3000`

### 2. Frontend Setup

```bash
# Navigate to frontend folder (in a new terminal)
cd gymhero-frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env

# Start the frontend
npm start
```

Frontend will run on: `http://localhost:3001`

## Usage

1. Open `http://localhost:3001` in your browser
2. Register a new account
3. Login with your credentials
4. Start posting workouts!

test account credentials:
email: test@test.com
password:123456789

## Author

Abdullah Aljubury  
Metropolia University of Applied Sciences  
Hybridisovellukset TX00EY68-3003
