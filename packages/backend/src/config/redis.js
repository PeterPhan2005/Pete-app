import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client for caching
const redisClient = createClient({ 
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis cache: Too many retries, giving up');
        return new Error('Too many retries');
      }
      return retries * 100; // Exponential backoff
    }
  }
});

// Error handling
redisClient.on('error', (err) => {
  console.error('❌ Redis Cache Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis Cache connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Cache ready');
});

// Connect to Redis
const connectRedisCache = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis Cache client connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect Redis Cache:', error);
  }
};

// Cache helper functions
const cache = {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`❌ Cache GET error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 1 hour)
   */
  async set(key, value, ttl = 3600) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      console.log(`✅ Cached: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`❌ Cache SET error for key ${key}:`, error);
    }
  },

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      await redisClient.del(key);
      console.log(`🗑️  Deleted cache: ${key}`);
    } catch (error) {
      console.error(`❌ Cache DEL error for key ${key}:`, error);
    }
  },

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Key pattern (e.g., "user:*")
   */
  async delPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🗑️  Deleted ${keys.length} cache keys matching: ${pattern}`);
      }
    } catch (error) {
      console.error(`❌ Cache DEL pattern error for ${pattern}:`, error);
    }
  },

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      return await redisClient.exists(key) === 1;
    } catch (error) {
      console.error(`❌ Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get or set cache (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not in cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetchFn, ttl = 3600) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        console.log(`📦 Cache HIT: ${key}`);
        return cached;
      }

      // Cache miss - fetch data
      console.log(`❌ Cache MISS: ${key}`);
      const data = await fetchFn();
      
      // Store in cache
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Cache getOrSet error for key ${key}:`, error);
      // Fallback to fetching data
      return await fetchFn();
    }
  },

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Promise<number>} - New value
   */
  async incr(key, amount = 1) {
    try {
      return await redisClient.incrBy(key, amount);
    } catch (error) {
      console.error(`❌ Cache INCR error for key ${key}:`, error);
      return 0;
    }
  },

  /**
   * Set expiration time for key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   */
  async expire(key, ttl) {
    try {
      await redisClient.expire(key, ttl);
    } catch (error) {
      console.error(`❌ Cache EXPIRE error for key ${key}:`, error);
    }
  }
};

export { redisClient, cache, connectRedisCache };
