const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let posts = [];

app.get('/', (req, res) => {
  res.render('index', { posts });
});

app.post('/create', (req, res) => {
  const { author, title, content } = req.body;
  posts.push({
    id: Date.now(),
    author,
    title,
    content,
    createdAt: new Date()
  });
  res.redirect('/');
});

app.get('/posts/:id/edit', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).send('Post not found');
  res.render('edit', { post });
});

app.post('/posts/:id/edit', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).send('Post not found');
  post.title = req.body.title;
  post.content = req.body.content;
  res.redirect('/');
});

app.post('/posts/:id/delete', (req, res) => {
  posts = posts.filter(p => p.id != req.params.id);
  res.redirect('/');
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
