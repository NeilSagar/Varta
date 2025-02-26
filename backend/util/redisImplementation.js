import { client } from '../connection/connectRedis.js';


const setCacheData = async (key, data, expiry = 10) => {
  try {
    await client.setEx(key, expiry, JSON.stringify(data));
    console.log(`Data cached with key: ${key}`);
  } catch (error) {
    console.error('Error caching data:', error);
  }
};


const getCacheData = async (key) => {
  try {
    const data = await client.get(key);
    if (data) {
      return JSON.parse(data);
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching cached data:', error);
    return null;
  }
};

const deleteCachedKey = async (key) => {
  try {
    const result = await client.del(key);
  } catch (err) {
    console.error('Error deleting key:', err);
  }
}


export { setCacheData, getCacheData, deleteCachedKey };
