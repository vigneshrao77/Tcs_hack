# Next.js + MongoDB + Node.js Fullstack Starter

A modern fullstack application boilerplate built with **Next.js 15+ (App Router)**, **Node.js runtime**, and **MongoDB (via Mongoose)** with TypeScript and Tailwind CSS.

---

## 🚀 Features

- **Next.js 15+ App Router**: Modern server and client components, layouts, and React 19 support.
- **Node.js Backend**: Built-in API route handlers (`/src/app/api/*`) for backend logic.
- **MongoDB & Mongoose**: Cached database singleton connection helper to handle hot-reloading smoothly without exhausting connections.
- **Sample Mongoose Model**: Pre-configured `Item` model at [`src/models/Item.ts`](file:///c:/Users/pegga/OneDrive/Desktop/Tcs/src/models/Item.ts).
- **API Endpoints**:
  - `GET /api/health` - Check MongoDB connection status
  - `GET /api/items` - Fetch list of items
  - `POST /api/items` - Insert a new item
- **Interactive UI**: Clean dashboard on [`src/app/page.tsx`](file:///c:/Users/pegga/OneDrive/Desktop/Tcs/src/app/page.tsx) to test database read/write actions live.

---

## 🛠️ Project Structure

```
├── .env.example          # Environment variable template
├── .env.local            # Local environment configuration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/   # Database health check API
│   │   │   └── items/    # CRUD operations API
│   │   ├── globals.css   # Tailwind styles
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Interactive dashboard page
│   ├── lib/
│   │   └── mongodb.ts    # Mongoose connection helper
│   └── models/
│       └── Item.ts       # Mongoose Item Schema & Model
├── package.json
└── tsconfig.json
```

---

## ⚙️ Getting Started

### 1. Configure MongoDB URI
Edit `.env.local` to point to your MongoDB instance:

**Local MongoDB**:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/tcs_db
```

**MongoDB Atlas (Cloud)**:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/tcs_db?retryWrites=true&w=majority
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production

```bash
npm run build
npm start
```
