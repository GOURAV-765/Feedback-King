require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// =======================
// SUPABASE DATABASE SETUP
// =======================
const supabaseUrl = process.env.SUPABASE_URL || 'https://PLACEHOLDER.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'PLACEHOLDER_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// =======================
// EXPRESS ROUTES FOR SUPABASE
// =======================

// 1. Register User
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Check if user exists
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
        
    if (existingUser) {
        return res.status(500).json({ error: "Username might already be taken." });
    }

    const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ username, password, role: 'user' }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });
});

// 2. Login User
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful!', user });
});

// 3. Add Product
app.post('/products', async (req, res) => {
    const { name, description, category, status } = req.body;
    
    const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{ 
            name, 
            description, 
            category: category || 'General', 
            status: status || 'Live' 
        }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'Product added successfully!', productId: newProduct.id });
});

// 4. Get Products
app.get('/products', async (req, res) => {
    // Note: To get precise total_reviews and avg_rating efficiently in Supabase,
    // we fetch products and related feedback and calculate manually for compatibility.
    // In production, this can be done via a Supabase SQL view.
    
    const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (prodErr) return res.status(500).json({ error: prodErr.message });
    
    const { data: feedbackData, error: feedErr } = await supabase
        .from('feedback')
        .select('product_id, rating');
        
    if (feedErr) return res.status(500).json({ error: feedErr.message });

    const result = productsData.map(p => {
        const productFeedback = feedbackData.filter(f => f.product_id === p.id);
        const total_reviews = productFeedback.length;
        const sum_rating = productFeedback.reduce((acc, f) => acc + f.rating, 0);
        const avg_rating = total_reviews > 0 ? sum_rating / total_reviews : 0;
        return { ...p, total_reviews, avg_rating };
    });
    
    res.status(200).json(result);
});

// 5. Add Feedback
app.post('/feedback', async (req, res) => {
    const { user_id, product_id, feedback_text, rating } = req.body;
    
    const { data: newFeedback, error } = await supabase
        .from('feedback')
        .insert([{ 
            user_id: Number(user_id), 
            product_id: Number(product_id), 
            feedback_text, 
            rating: Number(rating), 
            helpful_votes: 0 
        }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'Feedback added successfully!', feedbackId: newFeedback.id });
});

// 6. Get Feedback
app.get('/feedback', async (req, res) => {
    const { product_id } = req.query;
    
    let query = supabase
        .from('feedback')
        .select(`
            *,
            users ( username ),
            products ( name )
        `)
        .order('created_at', { ascending: false });

    if (product_id) {
        query = query.eq('product_id', product_id);
    }
    
    const { data: rawData, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Flatten nested relations for compatibility with existing frontend
    const result = rawData.map(f => ({
        ...f,
        username: f.users ? f.users.username : 'Unknown',
        product_name: f.products ? f.products.name : 'Unknown'
    }));
    
    // Cleanup nested objects
    result.forEach(f => {
        delete f.users;
        delete f.products;
    });

    res.status(200).json(result);
});

// 6.5. Upvote Feedback
app.post('/feedback/:id/upvote', async (req, res) => {
    const feedbackId = Number(req.params.id);
    
    // Supabase RPC or fetch-increment-update pattern
    const { data: fb } = await supabase
        .from('feedback')
        .select('helpful_votes')
        .eq('id', feedbackId)
        .single();
        
    if (!fb) return res.status(404).json({ error: 'Feedback not found' });

    const { error } = await supabase
        .from('feedback')
        .update({ helpful_votes: fb.helpful_votes + 1 })
        .eq('id', feedbackId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'Upvoted!' });
});

// 7. Delete Feedback
app.delete('/feedback/:id', async (req, res) => {
    const feedbackId = Number(req.params.id);
    
    const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'Feedback deleted successfully!' });
});

// Start the server locally only
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export the app for Vercel Serverless environment
module.exports = app;
