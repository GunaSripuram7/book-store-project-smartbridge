Demo link:-  "https://drive.google.com/file/d/1amQpJ9KHs0I-_YPj1Twu5x77iSkMs4SS/view?usp=sharing"

# Book Store (BookNest) - MERN Stack Project

BookNest is a full-stack online marketplace built using the MERN (MongoDB, Express, React, Node) stack. The platform allows users to browse and purchase books, enables sellers to manage their catalogs and orders, and provides administrators with control panels to manage accounts, listings, and approvals.

📂 Project Phase Documents
All development stages and milestones are documented in the Phase Wise Documents folder. Below are links to the individual deliverables for each phase:

💡 Phase 1: Brainstorming & Idea Generation
- [Brainstorming - Idea Generation.pdf](Phase%20Wise%20Documents/Phase%201%20-%20Brainstorming%20&%20Idea%20Generation/Brainstorming%20-%20Idea%20Generation.pdf)
- [Define Problem Statements.pdf](Phase%20Wise%20Documents/Phase%201%20-%20Brainstorming%20&%20Idea%20Generation/Define%20Problem%20Statements.pdf)
- [Empathy Map Canvas.pdf](Phase%20Wise%20Documents/Phase%201%20-%20Brainstorming%20&%20Idea%20Generation/Empathy%20Map%20Canvas.pdf)

📋 Phase 2: Requirement Analysis
- [Data Flow Diagrams and User Stories.pdf](Phase%20Wise%20Documents/Phase%202%20-%20Requirement%20Analysis/Data%20Flow%20Diagrams%20and%20User%20Stories.pdf)
- [Solution Requirements.pdf](Phase%20Wise%20Documents/Phase%202%20-%20Requirement%20Analysis/Solution%20Requirements.pdf)
- [Technology Stack.pdf](Phase%20Wise%20Documents/Phase%202%20-%20Requirement%20Analysis/Technology%20Stack.pdf)

🗺️ Phase 3: Project Planning
- [Project Planning.pdf](Phase%20Wise%20Documents/Phase%203%20-%20Project%20Planning/Project%20Planning.pdf)

🎨 Phase 4: Project Design
- [Problem - Solution Fit v1.pdf](Phase%20Wise%20Documents/Phase%204%20-%20Project%20Design/Problem%20-%20Solution%20Fit%20v1.pdf)
- [Proposed Solution.pdf](Phase%20Wise%20Documents/Phase%204%20-%20Project%20Design/Proposed%20Solution.pdf)
- [Solution Architecture.pdf](Phase%20Wise%20Documents/Phase%204%20-%20Project%20Design/Solution%20Architecture.pdf)

⚙️ Phase 5: Project Development & Testing
- [User Acceptance Testing FSD.pdf](Phase%20Wise%20Documents/Phase%205%20-%20Project%20Development%20&%20Testing/User%20Acceptance%20Testing%20FSD.pdf)

📄 Core Documentation
- **Full FSD Project Documentation (PDF)**: [BookStore_Documentation.pdf](Phase%20Wise%20Documents/BookStore_Documentation.pdf) (The final structured documentation compiling all schemas, structures, routes, and testing plans)
- **Product Requirement Document (PRD)**: [PRD.txt](Phase%20Wise%20Documents/PRD.txt)
- **Demo Walkthrough Video**: [Demo.mp4](Phase%20Wise%20Documents/Demo.mp4)

🛠️ Project Structure
book-store-project/
├── backend/                  # Node.js + Express.js backend server
│   ├── db/                   # Database configuration (config.js)
│   ├── models/               # MongoDB models & schemas
│   │   ├── Admin/            # AdminSchema.js
│   │   ├── Seller/           # BookSchema.js, SellerSchema.js
│   │   └── Users/            # MyOrders.js, UserSchema.js, Wishlist.js
│   ├── src/                  # Source files (server.js, auth.js, store.js, seed data)
│   └── uploads/              # Local uploaded book cover images
├── frontend/                 # React + Vite frontend client
│   ├── public/               # Public assets
│   ├── src/                  # React source files (App.jsx, main.jsx, styles.css)
│   └── vite.config.js        # Vite bundler config
└── Phase Wise Documents/     # Development milestone PDF deliverables

---

# Original Readme (BookNest)

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
