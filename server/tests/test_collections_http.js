require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Collection = require('./models/Collection');

async function test() {
  try {
    await connectDB();
    console.log('DB Connected.');

    // 1. Get user
    const user = await User.findOne();
    if (!user) {
      console.log('No user found in DB.');
      mongoose.disconnect();
      return;
    }
    console.log('Found User:', user.email, 'ID:', user._id);

    // 2. Generate token
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated JWT Token.');

    // 3. Get collection for user or create one
    let col = await Collection.findOne({ userId: user._id });
    if (!col) {
      col = new Collection({
        userId: user._id,
        name: 'HTTP Test Collection',
        description: 'Test description',
        coverImage: '',
        items: []
      });
      await col.save();
      console.log('Created Collection:', col.name, 'ID:', col._id);
    } else {
      console.log('Found Collection:', col.name, 'ID:', col._id);
    }

    // 4. Get movie
    const movie = await Movie.findOne();
    if (!movie) {
      console.log('No movie found in DB.');
      mongoose.disconnect();
      return;
    }
    console.log('Found Movie:', movie.title, 'ID:', movie._id);

    // 5. Clean up movie from collection first to avoid duplicate errors
    col.items = col.items.filter(item => item.entityId.toString() !== movie._id.toString());
    await col.save();

    // 6. Make HTTP POST Request
    console.log('\nSending HTTP POST to http://localhost:5000/api/collections/' + col._id + '/items ...');
    
    // Using fetch
    const response = await fetch(`http://localhost:5000/api/collections/${col._id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entityType: 'movie',
        entityId: movie._id.toString()
      })
    });

    console.log('HTTP Status:', response.status);
    console.log('HTTP Status Text:', response.statusText);
    
    const bodyText = await response.text();
    console.log('Response Body:', bodyText);

    mongoose.disconnect();
  } catch (err) {
    console.error('HTTP Test failed:', err);
    mongoose.disconnect();
  }
}

test();
