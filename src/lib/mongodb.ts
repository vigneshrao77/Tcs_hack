import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tcs_db";

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Scalability: Configure connection pooling and timeout settings for high concurrency
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 20, // Maintain up to 20 socket connections for parallel queries
      minPoolSize: 5,  // Keep at least 5 connections alive to eliminate handshake latency
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== "production",
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
