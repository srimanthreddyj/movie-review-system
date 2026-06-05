require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Cast = require('./models/Cast');
const Clip = require('./models/Clip');
const Collection = require('./models/Collection');
const TagAssignment = require('./models/TagAssignment');
const connectDB = require('./config/db');

async function runTests() {
  console.log('Connecting to database...');
  await connectDB();

  const suffix = Date.now();
  const testEmail = `test_coll_tag_${suffix}@example.com`;
  
  let testUser = null;
  let testMovie = null;
  let testCast = null;
  let testClip = null;
  let testCollection = null;
  let createdTag = null;

  try {
    // 1. Create Test Data
    console.log('Creating test user, movie, cast, clip...');
    testUser = new User({ name: 'Test User', email: testEmail, passwordHash: 'hash', role: 'user' });
    await testUser.save();

    testMovie = new Movie({ title: 'Dune (Test)', mediaType: 'movie' });
    await testMovie.save();

    testCast = new Cast({ name: 'Zendaya (Test)', gender: 'Female', knownFor: 'Actor' });
    await testCast.save();

    testClip = new Clip({ movieId: testMovie._id, title: 'Dune Trailer (Test)', url: 'https://youtube.com/dune', addedBy: testUser._id });
    await testClip.save();

    console.log('Test data created successfully.');

    // Helper mock objects to simulate express req, res
    const createMockReqRes = (body = {}, query = {}, params = {}) => {
      const req = {
        user: { id: testUser._id.toString(), role: testUser.role },
        body,
        query,
        params
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

    // 2. Test Collections Controller
    const collectionsController = require('./controllers/collectionsController');
    console.log('\n--- Collections Test 1: Create Collection ---');
    let { req, res } = createMockReqRes({ name: 'Sci-Fi Hits', description: 'My favorite space movies', coverImage: 'http://dune.jpg' });
    await collectionsController.createCollection(req, res);
    console.log('Create Collection status:', res.statusCode || 201);
    if (!res.data || !res.data._id) throw new Error('Collection creation failed');
    testCollection = res.data;

    console.log('\n--- Collections Test 2: Add Movie, Cast, and Clip to Collection ---');
    // Add Movie
    ({ req, res } = createMockReqRes({ entityType: 'movie', entityId: testMovie._id.toString() }, {}, { id: testCollection._id.toString() }));
    await collectionsController.addItem(req, res);
    console.log('Add Movie status:', res.statusCode || 200);

    // Add Cast
    ({ req, res } = createMockReqRes({ entityType: 'cast', entityId: testCast._id.toString() }, {}, { id: testCollection._id.toString() }));
    await collectionsController.addItem(req, res);
    console.log('Add Cast status:', res.statusCode || 200);

    // Add Clip
    ({ req, res } = createMockReqRes({ entityType: 'clip', entityId: testClip._id.toString() }, {}, { id: testCollection._id.toString() }));
    await collectionsController.addItem(req, res);
    console.log('Add Clip status:', res.statusCode || 200);

    console.log('\n--- Collections Test 3: Get Collection Details (Populated) ---');
    ({ req, res } = createMockReqRes({}, {}, { id: testCollection._id.toString() }));
    await collectionsController.getCollectionById(req, res);
    console.log('Get Collection details status:', res.statusCode || 200);
    console.log('Populated items count:', res.data.items.length);
    res.data.items.forEach(item => {
      console.log(`- Type: ${item.entityType}, Title/Name: ${item.details?.title || item.details?.name}`);
    });
    if (res.data.items.length !== 3) throw new Error('Populating collection items failed');

    console.log('\n--- Collections Test 4: Remove Cast from Collection ---');
    ({ req, res } = createMockReqRes({}, {}, { id: testCollection._id.toString(), entityId: testCast._id.toString() }));
    await collectionsController.removeItem(req, res);
    console.log('Remove item status:', res.statusCode || 200, 'items remaining:', res.data.items.length);
    if (res.data.items.length !== 2) throw new Error('Item removal failed');

    // 3. Test Tags Controller
    const tagsController = require('./controllers/tagsController');
    console.log('\n--- Tags Test 1: Create Tag ---');
    ({ req, res } = createMockReqRes({ name: 'Sci-Fi', color: '#ff0000' }));
    await tagsController.createTag(req, res);
    console.log('Create Tag status:', res.statusCode || 201, 'data:', res.data);
    if (!res.data || !res.data._id) throw new Error('Tag creation failed');
    createdTag = res.data;

    console.log('\n--- Tags Test 2: Assign Tag to Movie, Cast, and Clip ---');
    // Assign to Movie
    ({ req, res } = createMockReqRes({ entityId: testMovie._id.toString(), entityType: 'movie' }, {}, { tagId: createdTag._id.toString() }));
    await tagsController.assignTag(req, res);
    console.log('Assign to Movie status:', res.statusCode || 201);

    // Assign to Cast
    ({ req, res } = createMockReqRes({ entityId: testCast._id.toString(), entityType: 'cast' }, {}, { tagId: createdTag._id.toString() }));
    await tagsController.assignTag(req, res);
    console.log('Assign to Cast status:', res.statusCode || 201);

    // Assign to Clip
    ({ req, res } = createMockReqRes({ entityId: testClip._id.toString(), entityType: 'clip' }, {}, { tagId: createdTag._id.toString() }));
    await tagsController.assignTag(req, res);
    console.log('Assign to Clip status:', res.statusCode || 201);

    console.log('\n--- Tags Test 3: Query Entities using tagId filter ---');
    
    // Movie Catalogue Query with Tag
    const movieController = require('./controllers/movieController');
    ({ req, res } = createMockReqRes({}, { tagId: createdTag._id.toString() }));
    await movieController.getMovies(req, res);
    console.log('Filtered movies query results count:', res.data.movies.length);
    if (res.data.movies.length !== 1 || res.data.movies[0].title !== 'Dune (Test)') {
      throw new Error('Movie tag filtering failed');
    }

    // Cast Query with Tag
    const castController = require('./controllers/castController');
    ({ req, res } = createMockReqRes({}, { tagId: createdTag._id.toString() }));
    await castController.getCasts(req, res);
    console.log('Filtered cast query results count:', res.data.casts.length);
    if (res.data.casts.length !== 1 || res.data.casts[0].name !== 'Zendaya (Test)') {
      throw new Error('Cast tag filtering failed');
    }

    // Clip Query with Tag
    const clipsController = require('./controllers/clipsController');
    ({ req, res } = createMockReqRes({}, { tagId: createdTag._id.toString() }));
    await clipsController.getClips(req, res);
    console.log('Filtered clips query results count:', res.data.length);
    if (res.data.length !== 1 || res.data[0].title !== 'Dune Trailer (Test)') {
      throw new Error('Clip tag filtering failed');
    }

    console.log('\n--- Tags Test 4: Delete Tag and Verify Cascaded Assignment Cleanup ---');
    ({ req, res } = createMockReqRes({}, {}, { id: createdTag._id.toString() }));
    await tagsController.deleteTag(req, res);
    console.log('Delete tag status:', res.statusCode || 200);

    const assignmentsCount = await TagAssignment.countDocuments({ tagId: createdTag._id });
    console.log('Tag assignments count remaining in DB:', assignmentsCount);
    if (assignmentsCount !== 0) {
      throw new Error('Cascade delete of tag assignments failed');
    }

    console.log('\n--- Verification completed successfully! All checks passed. ---');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up database documents...');
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });
    if (testCast) await Cast.deleteOne({ _id: testCast._id });
    if (testClip) await Clip.deleteOne({ _id: testClip._id });
    if (testCollection) await Collection.deleteOne({ _id: testCollection._id });
    if (createdTag) {
      await TagAssignment.deleteMany({ tagId: createdTag._id });
    }

    console.log('Disconnecting from database...');
    await mongoose.connection.close();
    console.log('Finished.');
  }
}

runTests();
