const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI)

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: { type: String, required: true }
});

const ExerciseSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true }, // link exercises to users
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});

const UserModel = mongoose.model('user', UserSchema);
const ExerciseModel = mongoose.model('exercise', ExerciseSchema);

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username is required' });

    const newUser = new UserModel({ username });
    const saved = await newUser.save();

    return res.json({ username: saved.username, _id: saved._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// List all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await UserModel.find({}).select('username _id').exec();
    // returns array of { username, _id }
    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Add exercise to user
app.post('/api/users/:id/exercises', async (req, res) => {
  try {
    const id = req.params.id;
    const { description, duration, date } = req.body;

    const user = await UserModel.findById(id).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!description || !duration) {
      return res.status(400).json({ error: 'description and duration are required' });
    }

    const durationNum = Number(duration);
    if (Number.isNaN(durationNum)) {
      return res.status(400).json({ error: 'duration must be a number' });
    }

    // If date is provided and valid, use it; otherwise use current date
    let dateObj;
    if (date) {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) dateObj = new Date(); // fallback if invalid
    } else {
      dateObj = new Date();
    }

    const exercise = new ExerciseModel({
      userId: user._id,
      description,
      duration: durationNum,
      date: dateObj
    });

    const saved = await exercise.save();

    // Response must match: { username, description, duration, date, _id }
    return res.json({
      username: user.username,
      description: saved.description,
      duration: saved.duration,
      date: saved.date.toDateString(),
      _id: user._id
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user's exercise log with optional from, to, limit
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    const user = await UserModel.findById(_id).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const filter = { userId: _id };

    if (from || to) {
      filter.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) filter.date.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) filter.date.$lte = toDate;
      }
      // if both from and to are invalid, we won't set date filter - returns all
      if (Object.keys(filter.date).length === 0) delete filter.date;
    }

    let q = ExerciseModel.find(filter).select('description duration date -_id').sort({ date: 1 });
    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim) && lim > 0) q = q.limit(lim);
    }

    const exercises = await q.exec();

    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    // Build response with from & to placed right after username if provided
    const response = {
      _id: user._id,
      username: user.username,
      ...(from && { from: new Date(from).toDateString() }),
      ...(to && { to: new Date(to).toDateString() }),
      count: log.length,
      log
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
