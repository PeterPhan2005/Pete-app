import mongoose from 'mongoose';

export const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,              // Connection pool size
            serverSelectionTimeoutMS: 5000,  // Timeout for server selection
            socketTimeoutMS: 45000,      // Socket timeout
            family: 4,                   // Use IPv4
            retryWrites: true,           // Retry failed writes
        });
        console.log('✅ MongoDB Connected (pool size: 10)');
    }catch(error){
        console.error('❌ Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
}