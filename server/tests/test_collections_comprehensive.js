require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Cast = require('./models/Cast');
const Clip = require('./models/Clip');

async function runTest() {
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Get user
    const user = await User.findOne();
    if (!user) {
      console.error('No user found in DB.');
      mongoose.disconnect();
      return;
    }
    console.log(`Using User: ${user.email} (ID: ${user._id})`);

    // 2. Generate token
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 3. Create collection (POST /api/collections)
    console.log('\n--- Creating Collection ---');
    const colName = 'Comp Test ' + Date.now();
    const createRes = await fetch('http://localhost:5000/api/collections', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: colName,
        description: 'Comprehensive test collection',
        coverImage: 'http://example.com/cover.jpg'
      })
    });
    console.log('Create Status:', createRes.status);
    const col = await createRes.json();
    console.log('Created Collection ID:', col._id);

    // 4. Get all collections (GET /api/collections)
    console.log('\n--- Getting All Collections ---');
    const listRes = await fetch('http://localhost:5000/api/collections', { headers });
    console.log('List Status:', listRes.status);
    const list = await listRes.json();
    const found = list.find(c => c._id === col._id);
    console.log('Created collection present in list:', !!found);

    // 5. Find movie, cast, clip to add
    const movie = await Movie.findOne();
    const cast = await Cast.findOne();
    const clip = await Clip.findOne();

    console.log('\n--- Entities to save ---');
    console.log('Movie ID:', movie ? movie._id : 'NONE');
    console.log('Cast ID:', cast ? cast._id : 'NONE');
    console.log('Clip ID:', clip ? clip._id : 'NONE');

    // 6. Save items to collection (POST /api/collections/:id/items)
    if (movie) {
      console.log('\n--- Adding Movie ---');
      const addMovieRes = await fetch(`http://localhost:5000/api/collections/${col._id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entityType: 'movie', entityId: movie._id.toString() })
      });
      console.log('Add Movie Status:', addMovieRes.status);
      const addedMovie = await addMovieRes.json();
      console.log('Collection items count:', addedMovie.items.length);
    }

    if (cast) {
      console.log('\n--- Adding Cast ---');
      const addCastRes = await fetch(`http://localhost:5000/api/collections/${col._id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entityType: 'cast', entityId: cast._id.toString() })
      });
      console.log('Add Cast Status:', addCastRes.status);
      const addedCast = await addCastRes.json();
      console.log('Collection items count:', addedCast.items.length);
    }

    if (clip) {
      console.log('\n--- Adding Clip ---');
      const addClipRes = await fetch(`http://localhost:5000/api/collections/${col._id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entityType: 'clip', entityId: clip._id.toString() })
      });
      console.log('Add Clip Status:', addClipRes.status);
      const addedClip = await addClipRes.json();
      console.log('Collection items count:', addedClip.items.length);
    }

    // 7. Get collection details populated (GET /api/collections/:id)
    console.log('\n--- Fetching Collection Details ---');
    const detailsRes = await fetch(`http://localhost:5000/api/collections/${col._id}`, { headers });
    console.log('Details Status:', detailsRes.status);
    const details = await detailsRes.json();
    console.log('Collection Name:', details.name);
    console.log('Populated Items detail:');
    details.items.forEach(item => {
      console.log(`  - Type: ${item.entityType} | ID: ${item.entityId} | Details Populated:`, !!item.details);
      if (item.details) {
        console.log(`    Title/Name: ${item.details.title || item.details.name}`);
      }
    });

    // 8. Remove items (DELETE /api/collections/:id/items/:entityId)
    if (movie) {
      console.log('\n--- Removing Movie ---');
      const removeMovieRes = await fetch(`http://localhost:5000/api/collections/${col._id}/items/${movie._id}`, {
        method: 'DELETE',
        headers
      });
      console.log('Remove Movie Status:', removeMovieRes.status);
    }

    // 9. Delete collection (DELETE /api/collections/:id)
    console.log('\n--- Deleting Collection ---');
    const delRes = await fetch(`http://localhost:5000/api/collections/${col._id}`, {
      method: 'DELETE',
      headers
    });
    console.log('Delete Collection Status:', delRes.status);
    const delResult = await delRes.json();
    console.log('Delete result message:', delResult.message);

    mongoose.disconnect();
    console.log('\nTest finished.');
  } catch (err) {
    console.error('Test failed with error:', err);
    mongoose.disconnect();
  }
}

runTest();
