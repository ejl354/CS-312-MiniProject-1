const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const app = express();

// PostgreSQL connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'BlogDB',
  password: 'Bubbles',
  port: 5432,
});

// Set up EJS and static files
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session setup
app.use(session({
  secret: 'beep', // Change this to a strong secret in production!
  resave: false,
  saveUninitialized: false,
}));

// Middleware to require login
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/signin');
  }
  next();
}

// =================== AUTH ROUTES ===================

// GET: Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

// POST: Handle signup
app.post('/signup', async (req, res) => {
  const { user_id, password, name } = req.body;
  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
    if (userCheck.rows.length > 0) {
      return res.render('signup', { error: 'User ID already taken. Please choose another.' });
    }
    await pool.query(
      'INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)',
      [user_id, password, name]
    );
    res.redirect('/signin');
  } catch (err) {
    console.error(err);
    res.render('signup', { error: 'An error occurred. Please try again.' });
  }
});

// GET: Signin page
app.get('/signin', (req, res) => {
  res.render('signin', { error: null });
});

// POST: Handle signin
app.post('/signin', async (req, res) => {
  const { user_id, password } = req.body;
  try {
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE user_id = $1 AND password = $2',
      [user_id, password]
    );
    if (userQuery.rows.length === 0) {
      return res.render('signin', { error: 'Invalid user ID or password. Please try again.' });
    }
    req.session.user = {
      user_id: userQuery.rows[0].user_id,
      name: userQuery.rows[0].name,
    };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('signin', { error: 'An error occurred. Please try again.' });
  }
});

// GET: Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/signin');
  });
});

// =================== BLOG ROUTES ===================

// GET: Homepage - show all blog posts
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blogs ORDER BY date_created DESC');
    res.render('index', { posts: result.rows, user: req.session.user });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.sendStatus(500);
  }
});

// GET: Form to create new post (only logged in users)
app.get('/create', requireLogin, (req, res) => {
  res.render('create', { user: req.session.user, error: null });
});

// POST: Create new post
app.post('/create', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  try {
    await pool.query(
      `INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created)
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.session.user.name, req.session.user.user_id, title, content]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('create', { user: req.session.user, error: 'Error creating post. Please try again.' });
  }
});

// GET: Edit post form (only creator)
app.get('/posts/:id/edit', requireLogin, async (req, res) => {
  const postId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [postId]);
    if (result.rows.length === 0) return res.status(404).send('Post not found');
    const post = result.rows[0];
    if (post.creator_user_id !== req.session.user.user_id) {
      return res.status(403).send('Forbidden: You can only edit your own posts');
    }
    res.render('edit', { post, user: req.session.user, error: null });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// POST: Update post (only creator)
app.post('/posts/:id/edit', requireLogin, async (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;
  try {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [postId]);
    if (result.rows.length === 0) return res.status(404).send('Post not found');
    const post = result.rows[0];
    if (post.creator_user_id !== req.session.user.user_id) {
      return res.status(403).send('Forbidden: You can only edit your own posts');
    }
    await pool.query(
      'UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3',
      [title, content, postId]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('edit', { post: { blog_id: postId, title, body: content }, user: req.session.user, error: 'Error updating post.' });
  }
});

// POST: Delete post (only creator)
app.post('/posts/:id/delete', requireLogin, async (req, res) => {
  const postId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [postId]);
    if (result.rows.length === 0) return res.status(404).send('Post not found');
    const post = result.rows[0];
    if (post.creator_user_id !== req.session.user.user_id) {
      return res.status(403).send('Forbidden: You can only delete your own posts');
    }
    await pool.query('DELETE FROM blogs WHERE blog_id = $1', [postId]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// =================== START SERVER ===================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

