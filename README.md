# BookNest

BookNest is an original MERN bookstore built for the `book-store-project` folder. It keeps the full bookstore workflow but uses its own visual language, generated cover art, and a MongoDB-backed backend.

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

Since the project is set up using npm workspaces, you can manage and run both the frontend and backend from the root directory.

### Quick Start (Recommended)

1. **Install dependencies** for both frontend and backend in one go:
   ```bash
   npm install
   ```
2. **Start the Backend server** (in one terminal window):
   ```bash
   npm run dev:backend
   ```
   *(Runs on `http://localhost:4000`)*
3. **Start the Frontend app** (in a second terminal window):
   ```bash
   npm run dev:frontend
   ```
   *(Runs on `http://localhost:5173` or `http://localhost:5174`)*

---

### Alternative Method (Folder-by-Folder)

If you prefer to run them separately by navigating to each directory:

#### 1. Start the Backend
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies & start:
   ```bash
   npm install
   npm run dev
   ```

#### 2. Start the Frontend
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies & start:
   ```bash
   npm install
   npm run dev
   ```

## Notes

- **Stopping a Server**: If a server is already running and you need to stop it (for instance, if you get an `EADDRINUSE` error), click on the terminal window where it's running and press `Ctrl + C`. This safely kills the process.
- **Seeded Data**: Demo accounts and books are seeded automatically in MongoDB when you start the backend for the first time on a fresh database.
  - **Admin**: `admin@bookbound.local` (Password: `Admin@123` or `password123` if reseeded)
  - **Seller**: `seller1@bookbound.local` (Password: `Seller@123` or `password123` if reseeded)
  - **User/Reader**: `user@bookbound.local` (Password: `User@123` or `password123` if reseeded)
- **MongoDB Connection**: By default, the app looks for MongoDB at `mongodb://127.0.0.1:27017/BookBound`. You can override this by creating a `.env` file in the `backend` folder and setting `MONGO_URI=mongodb://127.0.0.1:27017/BookNest`.
