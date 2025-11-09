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

app.post('/api/users', async (req, res) => {

  try {
    const { username: user } = req.body

    const newUser = new UserModel ({
    username: user
  })

    const saved = await newUser.save();

    return res.json({
    username: saved.username,
    _id: saved.id
  })


  } catch(err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error'})
  }

});

app.post('/api/users/:id/exercises', async (req, res) => {

  try{
    const id = req.params.id;
    const { description, duration, date } = req.body

    const existing = await UserModel.findById(id).exec();

    if(!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

    const dateObj = new Date(date)

   const newExercise = new ExerciseModel ({
    userId: id, description, duration, date: dateObj
  })

  const saved = await newExercise.save();

   return res.json({
    // id: id, username: "testpogii", 
    _id: existing._id, username: existing.username, date: saved.date.toDateString(), duration: saved.duration, description: saved.description
  })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error'})
  }

});

app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    const user = await UserModel.findById(_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const filter = { userId: _id };
    if (Object.keys(dateFilter).length > 0) filter.date = dateFilter;

    let query = ExerciseModel.find(filter).select("description duration date -_id");
    if (limit) query = query.limit(parseInt(limit));

    const exercises = await query.exec();

    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    const response = {
      _id: user._id,
      username: user.username,
      ...(from && { from: new Date(from).toDateString() }),
      ...(to && { to: new Date(to).toDateString() }),
      count: log.length,
      log
    };

    // if (from) response.from = new Date(from).toDateString();
    // if (to) response.to = new Date(to).toDateString();

    return res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});




const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
