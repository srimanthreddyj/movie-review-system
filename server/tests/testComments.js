require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Comment = require('./models/Comment');
const connectDB = require('./config/db');

async function runTests() {
  console.log('Connecting to database...');
  await connectDB();

  const suffix = Date.now();
  const emailA = `test_comm_a_${suffix}@example.com`;
  const emailB = `test_comm_b_${suffix}@example.com`;

  let userA = null;
  let userB = null;
  let testMovie = null;
  let createdComment = null;

  try {
    // 1. Create Test Users & Movie
    console.log('Creating test users and movie...');
    userA = new User({ name: 'User A', email: emailA, passwordHash: 'hash', role: 'user' });
    userB = new User({ name: 'User B', email: emailB, passwordHash: 'hash', role: 'user' });
    await Promise.all([userA.save(), userB.save()]);

    testMovie = new Movie({ title: 'Memento (Test)', mediaType: 'movie' });
    await testMovie.save();

    console.log('Test setup completed.');

    // Helper mock objects to simulate express req, res
    const createMockReqRes = (user, body = {}, query = {}, params = {}) => {
      const req = {
        user: { id: user._id.toString(), role: user.role },
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

    const commentsController = require('./controllers/commentsController');

    // 2. Test Add Comment (User A)
    console.log('\n--- Comments Test 1: Add Comment (User A) ---');
    let { req, res } = createMockReqRes(userA, {
      entityType: 'movie',
      entityId: testMovie._id.toString(),
      text: 'Remember Sammy Jankis. Great film!'
    });
    await commentsController.addComment(req, res);
    console.log('Add Comment status:', res.statusCode || 201);
    if (!res.data || !res.data._id) throw new Error('Comment creation failed');
    createdComment = res.data;
    console.log('Comment text:', createdComment.text);

    // 3. Test Get Comments (User A vs User B - Privacy Check)
    console.log('\n--- Comments Test 2: Get Comments as Creator (User A) ---');
    ({ req, res } = createMockReqRes(userA, {}, {
      entityType: 'movie',
      entityId: testMovie._id.toString()
    }));
    await commentsController.getComments(req, res);
    console.log('User A comments found:', res.data.length);
    if (res.data.length !== 1 || res.data[0].text !== createdComment.text) {
      throw new Error('User A failed to retrieve their own comment');
    }

    console.log('\n--- Comments Test 3: Get Comments as Non-creator (User B - Should return 0) ---');
    ({ req, res } = createMockReqRes(userB, {}, {
      entityType: 'movie',
      entityId: testMovie._id.toString()
    }));
    await commentsController.getComments(req, res);
    console.log('User B comments found:', res.data.length);
    if (res.data.length !== 0) {
      throw new Error('User B was able to see User A\'s private comment!');
    }

    // 4. Test Edit Comment (Access Control)
    console.log('\n--- Comments Test 4: Edit Comment (Non-owner - Should fail) ---');
    ({ req, res } = createMockReqRes(userB, { text: 'Hacked comment' }, {}, { id: createdComment._id.toString() }));
    await commentsController.updateComment(req, res);
    console.log('Edit status (User B):', res.statusCode);
    if (res.statusCode !== 403) {
      throw new Error('User B was allowed to edit User A\'s comment!');
    }

    console.log('\n--- Comments Test 5: Edit Comment (Owner - Should succeed) ---');
    ({ req, res } = createMockReqRes(userA, { text: 'Sammy Jankis is the key. Masterpiece!' }, {}, { id: createdComment._id.toString() }));
    await commentsController.updateComment(req, res);
    console.log('Edit status (User A):', res.statusCode || 200);
    if (res.data.text !== 'Sammy Jankis is the key. Masterpiece!') {
      throw new Error('Owner failed to edit comment');
    }

    // 5. Test Delete Comment
    console.log('\n--- Comments Test 6: Delete Comment (Non-owner - Should fail) ---');
    ({ req, res } = createMockReqRes(userB, {}, {}, { id: createdComment._id.toString() }));
    await commentsController.deleteComment(req, res);
    console.log('Delete status (User B):', res.statusCode);
    if (res.statusCode !== 403) {
      throw new Error('User B was allowed to delete User A\'s comment!');
    }

    console.log('\n--- Comments Test 7: Delete Comment (Owner - Should succeed) ---');
    ({ req, res } = createMockReqRes(userA, {}, {}, { id: createdComment._id.toString() }));
    await commentsController.deleteComment(req, res);
    console.log('Delete status (User A):', res.statusCode || 200, 'data:', res.data);

    // Verify deleted from DB
    const commentCheck = await Comment.findById(createdComment._id);
    if (commentCheck) throw new Error('Comment still exists in database');
    console.log('Comment verified deleted from DB.');

    console.log('\n--- Verification completed successfully! All checks passed. ---');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up database documents...');
    if (userA) await User.deleteOne({ _id: userA._id });
    if (userB) await User.deleteOne({ _id: userB._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });
    if (createdComment) await Comment.deleteOne({ _id: createdComment._id });

    console.log('Disconnecting from database...');
    await mongoose.connection.close();
    console.log('Finished.');
  }
}

runTests();
