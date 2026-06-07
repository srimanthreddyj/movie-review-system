const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Cast = require('./models/Cast');
const Movie = require('./models/Movie');
const TagAssignment = require('./models/TagAssignment');
const Comment = require('./models/Comment');
const Collection = require('./models/Collection');
const User = require('./models/User');

const deduplicateCast = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing from environment variables');
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    // 1. Fetch all cast members
    const castMembers = await Cast.find({});
    console.log(`Found ${castMembers.length} total cast members in database.`);

    // 2. Group by normalized name
    const grouped = new Map();
    castMembers.forEach(c => {
      const normalized = c.name.toLowerCase().trim();
      if (!grouped.has(normalized)) {
        grouped.set(normalized, []);
      }
      grouped.get(normalized).push(c);
    });

    let duplicatesFound = 0;
    let mergedCount = 0;

    for (const [name, members] of grouped.entries()) {
      if (members.length > 1) {
        duplicatesFound++;
        console.log(`\nDuplicate found for: "${members[0].name}" (${members.length} records)`);

        // Sort members: prioritize the one that has tmdbId, photoUrl, or bio
        members.sort((a, b) => {
          const score = (m) => {
            let s = 0;
            if (m.tmdbId) s += 10;
            if (m.imdbId) s += 5;
            if (m.photoUrl && !m.photoUrl.includes('example.com')) s += 5;
            if (m.bio) s += 3;
            if (m.isPopular) s += 2;
            return s;
          };
          return score(b) - score(a);
        });

        const survivor = members[0];
        const duplicates = members.slice(1);

        console.log(`  Survivor: ID ${survivor._id} | tmdbId: ${survivor.tmdbId} | Popular: ${survivor.isPopular}`);

        for (const duplicate of duplicates) {
          console.log(`  Merging duplicate: ID ${duplicate._id} | tmdbId: ${duplicate.tmdbId} | Popular: ${duplicate.isPopular}`);

          // Merge fields from duplicate to survivor if survivor lacks them
          if (!survivor.tmdbId && duplicate.tmdbId) {
            survivor.tmdbId = duplicate.tmdbId;
          }
          if (!survivor.imdbId && duplicate.imdbId) {
            survivor.imdbId = duplicate.imdbId;
          }
          if ((!survivor.photoUrl || survivor.photoUrl.includes('example.com')) && duplicate.photoUrl) {
            survivor.photoUrl = duplicate.photoUrl;
          }
          if (!survivor.bio && duplicate.bio) {
            survivor.bio = duplicate.bio;
          }
          if (!survivor.birthDate && duplicate.birthDate) {
            survivor.birthDate = duplicate.birthDate;
          }
          if (!survivor.nationality && duplicate.nationality) {
            survivor.nationality = duplicate.nationality;
          }
          if (survivor.gender === 'Unspecified' && duplicate.gender && duplicate.gender !== 'Unspecified') {
            survivor.gender = duplicate.gender;
          }
          if (duplicate.isPopular) {
            survivor.isPopular = true;
          }

          const oldId = duplicate._id;
          const newId = survivor._id;

          // Update Movie cast lists
          const movieRes = await Movie.updateMany(
            { "cast.castId": oldId },
            { $set: { "cast.$[elem].castId": newId } },
            { arrayFilters: [{ "elem.castId": oldId }] }
          );
          if (movieRes.modifiedCount > 0) {
            console.log(`    Updated ${movieRes.modifiedCount} movies cast list references.`);
          }

          // Update TagAssignments
          const tagRes = await TagAssignment.updateMany(
            { entityId: oldId, entityType: 'cast' },
            { $set: { entityId: newId } }
          );
          if (tagRes.modifiedCount > 0) {
            console.log(`    Updated ${tagRes.modifiedCount} tag assignment references.`);
          }

          // Update Comments
          const commentRes = await Comment.updateMany(
            { entityId: oldId, entityType: 'cast' },
            { $set: { entityId: newId } }
          );
          if (commentRes.modifiedCount > 0) {
            console.log(`    Updated ${commentRes.modifiedCount} comment references.`);
          }

          // Update Collection item references
          const collRes = await Collection.updateMany(
            { "items.entityId": oldId, "items.entityType": "cast" },
            { $set: { "items.$[elem].entityId": newId } },
            { arrayFilters: [{ "elem.entityId": oldId, "elem.entityType": "cast" }] }
          );
          if (collRes.modifiedCount > 0) {
            console.log(`    Updated ${collRes.modifiedCount} collection items references.`);
          }

          // Update User favorites
          const userRes = await User.updateMany(
            { "favourites.cast.entityId": oldId },
            { $set: { "favourites.cast.$[elem].entityId": newId } },
            { arrayFilters: [{ "elem.entityId": oldId }] }
          );
          if (userRes.modifiedCount > 0) {
            console.log(`    Updated ${userRes.modifiedCount} user favourites references.`);
          }

          // Delete the duplicate cast member record
          await Cast.deleteOne({ _id: oldId });
          mergedCount++;
        }

        // Save updated survivor
        await survivor.save();
        console.log(`  Survivor saved successfully!`);
      }
    }

    console.log(`\nDeduplication completed. Found ${duplicatesFound} duplicate profiles, successfully merged and cleaned up ${mergedCount} redundant records.`);
  } catch (err) {
    console.error('Error during deduplication:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

deduplicateCast();
