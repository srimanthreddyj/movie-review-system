const Settings = require('../models/Settings');

// In-memory cache to prevent hitting DB on every external API request
let externalApisEnabledCache = true;

// Initialize cache from DB on startup
const initSettings = async () => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings({ externalApisEnabled: true });
      await settings.save();
    }
    externalApisEnabledCache = settings.externalApisEnabled;
    console.log(`[Settings] External APIs enabled: ${externalApisEnabledCache}`);
  } catch (error) {
    console.error('Failed to initialize settings:', error.message);
  }
};
initSettings();

exports.isExternalApiEnabled = () => {
  return externalApisEnabledCache;
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings({ externalApisEnabled: true });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { externalApisEnabled } = req.body;
    let settings = await Settings.findOne({});
    
    if (!settings) {
      settings = new Settings({ externalApisEnabled: true });
    }

    if (typeof externalApisEnabled === 'boolean') {
      settings.externalApisEnabled = externalApisEnabled;
      externalApisEnabledCache = externalApisEnabled; // Update cache synchronously
    }

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
