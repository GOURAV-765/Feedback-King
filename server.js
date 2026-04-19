const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// =======================
// IN-MEMORY MOCK DATABASE
// (Works flawlessly on Vercel Serverless Functions - ZERO SETUP REQUIRED)
// =======================
let users = [];
let products = [];
let feedback = [];
let userIds = 1;
let productIds = 1;
let feedbackIds = 1;

function initializeDatabase() {
    // Check if admin exists
    if (users.length === 0) {
        console.log("Generating Default Live Data...");
        users.push({ id: userIds++, username: 'admin', password: 'admin', role: 'admin', created_at: new Date() });
        
        const defaultProducts = [
            { name: 'Lumina AI Keyboard', description: 'A predictive typing assistant using advanced LLM integration directly onto your physical keyboard interface.', category: 'Hardware', status: 'In-Progress' },
            { name: 'NexSync Cloud', description: 'Ultra-fast serverless file syncing optimized for large media and 3D rendering workflows.', category: 'Software', status: 'Live' },
            { name: 'Nexus Watch App', description: 'A companion fitness and health application integrating with Nexus smart devices.', category: 'App', status: 'Planned' },
            { name: 'Evo Drone X', description: 'Next-generation aerial drone with automated mapping features.', category: 'Hardware', status: 'Live' },
            { name: 'CodeAssist IDE', description: 'Blazing fast code editor with AI debugging capabilities.', category: 'Software', status: 'In-Progress' },
            { name: 'Fitness Journey', description: 'Track your daily workouts, macros, and sleep health.', category: 'App', status: 'Live' },
            { name: 'HoloLens Display', description: 'An augmented reality monitor replacement tool.', category: 'Hardware', status: 'Planned' }
        ];

        defaultProducts.forEach(p => {
            products.push({ id: productIds++, ...p, created_at: new Date() });
        });
    }
}
// Run initialization
initializeDatabase();

// =======================
// EXPRESS ROUTES FOR MOCK DB
// =======================

// 1. Register User
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
      return res.status(500).json({ error: "Username might already be taken." });
  }
  const newUser = { id: userIds++, username, password, role: 'user', created_at: new Date() };
  users.push(newUser);
  res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });
});

// 2. Login User
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  res.status(200).json({ message: 'Login successful!', user });
});

// 3. Add Product
app.post('/products', (req, res) => {
  const { name, description, category, status } = req.body;
  const newProduct = { 
      id: productIds++, 
      name, 
      description, 
      category: category || 'General', 
      status: status || 'Live', 
      created_at: new Date() 
  };
  products.push(newProduct);
  res.status(201).json({ message: 'Product added successfully!', productId: newProduct.id });
});

// 4. Get Products
app.get('/products', (req, res) => {
  const result = products.map(p => {
      const productFeedback = feedback.filter(f => f.product_id == p.id);
      const total_reviews = productFeedback.length;
      const sum_rating = productFeedback.reduce((acc, f) => acc + f.rating, 0);
      const avg_rating = total_reviews > 0 ? sum_rating / total_reviews : 0;
      
      let latest_feedback = null;
      if (total_reviews > 0) {
          const latest = productFeedback[productFeedback.length - 1]; // last submitted is at the end of the array
          const u = users.find(u => u.id === latest.user_id);
          latest_feedback = {
              username: u ? u.username : 'Unknown Client',
              feedback_text: latest.feedback_text
          };
      }

      return { ...p, total_reviews, avg_rating, latest_feedback };
  });
  
  result.sort((a,b) => b.created_at - a.created_at);
  res.status(200).json(result);
});

// 5. Add Feedback
app.post('/feedback', (req, res) => {
  const { user_id, product_id, feedback_text, rating } = req.body;
  const newFeedback = { 
      id: feedbackIds++, 
      user_id: Number(user_id), 
      product_id: Number(product_id), 
      feedback_text, 
      rating: Number(rating), 
      helpful_votes: 0, 
      created_at: new Date() 
  };
  feedback.push(newFeedback);
  res.status(201).json({ message: 'Feedback added successfully!', feedbackId: newFeedback.id });
});

// 6. Get Feedback
app.get('/feedback', (req, res) => {
  const { product_id } = req.query;
  let filteredFeedback = feedback;
  if (product_id) {
      filteredFeedback = filteredFeedback.filter(f => f.product_id == product_id);
  }
  
  const result = filteredFeedback.map(f => {
      const u = users.find(u => u.id === f.user_id);
      const p = products.find(p => p.id === f.product_id);
      return { 
          ...f, 
          username: u ? u.username : 'Unknown', 
          product_name: p ? p.name : 'Unknown' 
      };
  });
  
  result.sort((a,b) => b.created_at - a.created_at);
  res.status(200).json(result);
});

// 6.5. Upvote Feedback
app.post('/feedback/:id/upvote', (req, res) => {
  const feedbackId = Number(req.params.id);
  const fb = feedback.find(f => f.id === feedbackId);
  if (fb) {
      fb.helpful_votes += 1;
      res.status(200).json({ message: 'Upvoted!' });
  } else {
      res.status(404).json({ error: 'Feedback not found' });
  }
});

// 7. Delete Feedback
app.delete('/feedback/:id', (req, res) => {
  const feedbackId = Number(req.params.id);
  const index = feedback.findIndex(f => f.id === feedbackId);
  if (index !== -1) {
      feedback.splice(index, 1);
      res.status(200).json({ message: 'Feedback deleted successfully!' });
  } else {
      res.status(404).json({ message: 'Feedback not found' });
  }
});

// Start the server locally only
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export the app for Vercel Serverless environment
module.exports = app;
