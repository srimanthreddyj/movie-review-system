const Collection = require('../models/Collection');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const Clip = require('../models/Clip');

// Get all collections for the authenticated user
exports.getCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single collection by ID with populated items
exports.getCollectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Extract item IDs by type
    const movieIds = [];
    const castIds = [];
    const clipIds = [];

    collection.items.forEach(item => {
      if (item.entityType === 'movie') movieIds.push(item.entityId);
      else if (item.entityType === 'cast') castIds.push(item.entityId);
      else if (item.entityType === 'clip') clipIds.push(item.entityId);
    });

    // Fetch details in parallel
    const [movies, casts, clips] = await Promise.all([
      Movie.find({ _id: { $in: movieIds } }),
      Cast.find({ _id: { $in: castIds } }),
      Clip.find({ _id: { $in: clipIds } }).populate('movieId', 'title')
    ]);

    // Map details back to items
    const populatedItems = collection.items.map(item => {
      let details = null;
      if (item.entityType === 'movie') {
        details = movies.find(m => m._id.toString() === item.entityId.toString());
      } else if (item.entityType === 'cast') {
        details = casts.find(c => c._id.toString() === item.entityId.toString());
      } else if (item.entityType === 'clip') {
        details = clips.find(c => c._id.toString() === item.entityId.toString());
      }

      return {
        _id: item._id,
        entityType: item.entityType,
        entityId: item.entityId,
        details: details || null
      };
    });

    // Return the collection with items populated
    const collectionObj = collection.toObject();
    collectionObj.items = populatedItems;

    res.json(collectionObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new collection
exports.createCollection = async (req, res) => {
  try {
    const { name, description, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Collection name is required' });
    }

    const newCollection = new Collection({
      userId: req.user.id,
      name,
      description: description || '',
      coverImage: coverImage || '',
      items: []
    });

    await newCollection.save();
    res.status(201).json(newCollection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update collection details
exports.updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, coverImage } = req.body;

    const collection = await Collection.findById(id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (coverImage !== undefined) collection.coverImage = coverImage;

    await collection.save();
    res.json(collection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a collection
exports.deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Collection.deleteOne({ _id: id });
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { entityType, entityId } = req.body;
    console.log(`[Collection AddItem] Request params - Collection ID: "${id}", EntityType: "${entityType}", EntityId: "${entityId}"`);

    if (!entityType || !entityId) {
      console.log('[Collection AddItem] Validation failed: missing parameters');
      return res.status(400).json({ message: 'entityType and entityId are required' });
    }

    if (!['movie', 'cast', 'clip'].includes(entityType)) {
      console.log(`[Collection AddItem] Validation failed: invalid entityType "${entityType}"`);
      return res.status(400).json({ message: 'Invalid entityType. Must be movie, cast, or clip.' });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      console.log(`[Collection AddItem] Collection not found for ID "${id}"`);
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.userId.toString() !== req.user.id) {
      console.log(`[Collection AddItem] Access denied: User ${req.user.id} does not own collection ${id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify entity exists in DB
    let entityExists = false;
    if (entityType === 'movie') {
      entityExists = await Movie.exists({ _id: entityId });
    } else if (entityType === 'cast') {
      entityExists = await Cast.exists({ _id: entityId });
    } else if (entityType === 'clip') {
      entityExists = await Clip.exists({ _id: entityId });
    }

    console.log(`[Collection AddItem] Entity checks finished. EntityExists: ${entityExists}`);

    if (!entityExists) {
      console.log(`[Collection AddItem] Entity not found in DB: Type "${entityType}", ID "${entityId}"`);
      return res.status(404).json({ message: `${entityType} not found` });
    }

    // Check if item already exists in collection
    const itemExists = collection.items.some(
      item => item.entityType === entityType && item.entityId.toString() === entityId.toString()
    );

    if (itemExists) {
      return res.status(400).json({ message: 'Item already in collection' });
    }

    collection.items.push({ entityType, entityId });
    await collection.save();

    res.json(collection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove item from collection
exports.removeItem = async (req, res) => {
  try {
    const { id, entityId } = req.params;

    const collection = await Collection.findById(id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find the item index
    const itemIndex = collection.items.findIndex(
      item => item.entityId.toString() === entityId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in collection' });
    }

    collection.items.splice(itemIndex, 1);
    await collection.save();

    res.json(collection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
