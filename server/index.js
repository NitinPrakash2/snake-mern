const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/snakegame');

const ScoreSchema = new mongoose.Schema({
  name: String,
  score: Number,
  date: { type: Date, default: Date.now }
});
const Score = mongoose.model('Score', ScoreSchema);

app.get('/scores', async (req, res) => {
  const scores = await Score.find().sort({ score: -1 }).limit(10);
  res.json(scores);
});

app.post('/scores', async (req, res) => {
  const { name, score } = req.body;
  const newScore = await Score.create({ name, score });
  res.json(newScore);
});

app.listen(5000, () => console.log('Server running on port 5000'));
