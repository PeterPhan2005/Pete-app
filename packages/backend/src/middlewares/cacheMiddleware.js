import { cache } from '../config/redis.js';

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 * @param {Function} keyGenerator - Function to generate cache key from req
 */
export const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `cache:${req.originalUrl}:${req.user?._id || 'anonymous'}`;

      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        console.log(`📦 Cache HIT: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          cache.set(cacheKey, data, ttl).catch(err => {
            console.error('Failed to cache response:', err);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Invalidate cache for specific patterns
 * @param {string|string[]} patterns - Cache key patterns to invalidate
 */
export const invalidateCache = async (patterns) => {
  try {
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];
    
    for (const pattern of patternArray) {
      await cache.delPattern(pattern);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

/**
 * Cache key generators
 */
export const cacheKeys = {
  user: (userId) => `user:${userId}`,
  userProfile: (userId) => `user:profile:${userId}`,
  userFriends: (userId) => `user:friends:${userId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
  conversationMessages: (conversationId, page = 1) => `conversation:${conversationId}:messages:${page}`,
  userConversations: (userId) => `user:${userId}:conversations`,
  onlineUsers: () => 'online:users',
};
