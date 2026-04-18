const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Automatically connect to SQLite Database!
// On Vercel, the root file system is read-only, so we MUST write to /tmp.
const dbPath = process.env.VERCEL ? '/tmp/database.sqlite' : './database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to create SQLite Database:', err.message);
  } else {
    console.log(`Connected to Local SQLite Database successfully at ${dbPath}!`);
    initializeDatabase();
  }
});

// Auto-build the newly converted schema so it just works perfectly out of the box
function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'General',
            status TEXT DEFAULT 'Live',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            feedback_text TEXT NOT NULL,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            helpful_votes INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(id),
            FOREIGN KEY (product_id) REFERENCES Products(id)
        )`);

        // Check if admin exists to avoid inserting duplicates on multiple runs
        db.get("SELECT COUNT(*) as count FROM Users", (err, row) => {
            if (row.count === 0) {
                console.log("Empty DB detected. Generating default test data...");
                db.run(`INSERT INTO Users (username, password, role) VALUES ('admin', 'admin', 'admin')`);
                db.run(`INSERT INTO Products (name, description, category, status) VALUES 
                ('Lumina AI Keyboard', 'A predictive typing assistant using advanced LLM integration directly onto your physical keyboard interface.', 'Hardware', 'In-Progress'),
                ('NexSync Cloud', 'Ultra-fast serverless file syncing optimized for large media and 3D rendering workflows.', 'Software', 'Live'),
                ('Nexus Watch App', 'A companion fitness and health application integrating with Nexus smart devices.', 'App', 'Planned'),
                ('Evo Drone X', 'Next-generation aerial drone with automated mapping features.', 'Hardware', 'Live'),
                ('CodeAssist IDE', 'Blazing fast code editor with AI debugging capabilities.', 'Software', 'In-Progress'),
                ('Fitness Journey', 'Track your daily workouts, macros, and sleep health.', 'App', 'Live'),
                ('HoloLens Display', 'An augmented reality monitor replacement tool.', 'Hardware', 'Planned')`);
            }
        });
    });
}

// =======================
// EXPRESS ROUTES FOR SQLITE
// =======================

// 1. Register User
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const query = 'INSERT INTO Users (username, password) VALUES (?, ?)';
  
  db.run(query, [username, password], function(err) {
    if (err) return res.status(500).json({ error: "Username might already be taken." });
    res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
  });
});

// 2. Login User
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM Users WHERE username = ? AND password = ?';
  
  db.get(query, [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ message: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful!', user: row });
  });
});

// 3. Add Product
app.post('/products', (req, res) => {
  const { name, description, category, status } = req.body;
  const query = 'INSERT INTO Products (name, description, category, status) VALUES (?, ?, ?, ?)';
  
  db.run(query, [name, description, category || 'General', status || 'Live'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Product added successfully!', productId: this.lastID });
  });
});

// 4. Get Products
app.get('/products', (req, res) => {
  const query = `
    SELECT p.*, 
      COUNT(f.id) as total_reviews, 
      IFNULL(AVG(f.rating), 0) as avg_rating 
    FROM Products p 
    LEFT JOIN Feedback f ON p.id = f.product_id 
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

// 5. Add Feedback
app.post('/feedback', (req, res) => {
  const { user_id, product_id, feedback_text, rating } = req.body;
  const query = 'INSERT INTO Feedback (user_id, product_id, feedback_text, rating) VALUES (?, ?, ?, ?)';
  
  db.run(query, [user_id, product_id, feedback_text, rating], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Feedback added successfully!', feedbackId: this.lastID });
  });
});

// 6. Get Feedback
app.get('/feedback', (req, res) => {
  const { product_id } = req.query;
  let query = `
    SELECT Feedback.*, Users.username, Products.name as product_name 
    FROM Feedback 
    JOIN Users ON Feedback.user_id = Users.id 
    JOIN Products ON Feedback.product_id = Products.id
  `;
  let queryParams = [];

  if (product_id) {
    query += ' WHERE product_id = ?';
    queryParams.push(product_id);
  }
  
  query += ' ORDER BY Feedback.created_at DESC';

  db.all(query, queryParams, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

// 6.5. Upvote Feedback
app.post('/feedback/:id/upvote', (req, res) => {
  const feedbackId = req.params.id;
  const query = 'UPDATE Feedback SET helpful_votes = helpful_votes + 1 WHERE id = ?';
  db.run(query, [feedbackId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Upvoted!' });
  });
});

// 7. Delete Feedback
app.delete('/feedback/:id', (req, res) => {
  const feedbackId = req.params.id;
  const query = 'DELETE FROM Feedback WHERE id = ?';
  
  db.run(query, [feedbackId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Feedback not found' });
    res.status(200).json({ message: 'Feedback deleted successfully!' });
  });
});

// Start the server locally only
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export the app for Vercel Serverless environment
module.exports = app;
