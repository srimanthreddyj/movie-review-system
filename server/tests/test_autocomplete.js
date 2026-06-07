require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const movieController = require('./controllers/movieController');

async function testAutocomplete() {
  console.log('Connecting to database...');
  await connectDB();

  const createMockReqRes = (queryStr) => {
    const req = {
      query: { q: queryStr }
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };
    return { req, res };
  };

  try {
    const searchQuery = 'Interstellar';
    console.log(`\n--- Testing Autocomplete for query: "${searchQuery}" ---`);

    const { req, res } = createMockReqRes(searchQuery);
    await movieController.autocomplete(req, res);

    console.log('Response Status:', res.statusCode || 200);
    console.log('Results Count:', res.data ? res.data.length : 0);
    
    if (res.data && res.data.length > 0) {
      console.log('Autocomplete sample result:');
      console.log(res.data.slice(0, 3));
    } else {
      console.log('No autocomplete results returned.');
    }
  } catch (error) {
    console.error('Autocomplete test execution failed:', error);
  } finally {
    console.log('\nClosing DB connection...');
    await mongoose.connection.close();
    console.log('Done.');
  }
}

testAutocomplete();
