# BookVerse

BookVerse is an original MERN bookstore built for the `book-store-project` folder. It keeps the full bookstore workflow but uses its own visual language, generated cover art, and a MongoDB-backed backend.

## What is included

- User, seller, and admin authentication
- Book browsing, search, sort, and genre filtering
- Wishlist and cart flows
- Checkout and order tracking
- Seller inventory management
- Admin overview and user management
- Distinct UI styling with responsive layouts

## Required Software to Install

To properly run this project, make sure you have the following software installed on your machine:
1. **Node.js**: Needed to run both the React frontend and the Express backend. (Install v16 or later)
2. **MongoDB Community Server**: Your local database engine. The server must be running in the background.
3. **MongoDB Compass** (Optional but Recommended): A visual tool to view your local databases and collections.
4. **Mongo Shell (mongosh)** (Optional): A command line interface to interact with your MongoDB databases.

## How to Run the Project Locally

You will need to open **two separate terminal windows** (one for the backend, one for the frontend).

### 1. Start the Backend

1. Open a new terminal.
2. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
3. Install the dependencies (you only need to do this once):
   ```bash
   npm install
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```
*(The backend will run on `http://localhost:4000` and automatically connect to your local MongoDB server)*

### 2. Start the Frontend

1. Open a **second**, separate terminal.
2. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
3. Install the dependencies (you only need to do this once):
   ```bash
   npm install
   ```
4. Start the React app:
   ```bash
   npm run dev
   ```
*(The frontend will usually run on `http://localhost:5173` or `http://localhost:5174`. Open this link in your browser to view the app!)*

## Notes

- **Stopping a Server**: If a server is already running and you need to stop it (for instance, if you get an `EADDRINUSE` error), click on the terminal window where it's running and press `Ctrl + C`. This safely kills the process.
- **Seeded Data**: Demo accounts and books are seeded automatically in MongoDB when you start the backend for the first time on a fresh database.
- **MongoDB Connection**: By default, the app looks for MongoDB at `mongodb://127.0.0.1:27017/BookVerse`. You can override this by creating a `.env` file in the backend folder.
