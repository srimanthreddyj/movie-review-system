require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Collection = require('./models/Collection');
const User = require('./models/User');

async function run() {
  try {
    await connectDB();
    console.log('MongoDB Connected.');

    const users = await User.find({}, 'name email role');
    console.log(`\n--- USERS IN DB (${users.length}) ---`);
    users.forEach(u => console.log(`User: ${u.name} | Email: ${u.email} | Role: ${u.role} | ID: ${u._id}`));

    const collections = await Collection.find({});
    console.log(`\n--- COLLECTIONS IN DB (${collections.length}) ---`);
    collections.forEach(c => {
      console.log(`Collection: "${c.name}" | ID: ${c._id} | UserID: ${c.userId} | Items: ${c.items.length}`);
      c.items.forEach(item => {
        console.log(`  - Type: ${item.entityType} | ID: ${item.entityId}`);
      });
    });

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    mongoose.disconnect();
  }
}

run();
