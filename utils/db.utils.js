// config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
  console.log('Connecting to MongoDB...');
  
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Options for local MongoDB
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
    });
    
    console.log(`MongoDB connected successfully: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    
    // Provide helpful error messages for local MongoDB
    if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') {
      console.error('\nPossible issues:');
      console.error('1. Make sure MongoDB is running locally');
      console.error('2. Check if MongoDB is running on the default port 27017');
      console.error('3. Verify your connection string in .env file');
      console.error('4. Try starting MongoDB with: mongod (or check if it\'s running as a service)');
    }
    
    process.exit(1);
  }
};

export default connectDB;
