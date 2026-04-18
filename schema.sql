DROP DATABASE IF EXISTS product_feedback_db;
CREATE DATABASE product_feedback_db;
USE product_feedback_db;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'General',
    status ENUM('Planned', 'In-Progress', 'Live') DEFAULT 'Live',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    feedback_text TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    helpful_votes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE
);

-- Insert Mock Data
INSERT INTO Users (username, password, role) VALUES ('admin', 'admin', 'admin');
INSERT INTO Products (name, description, category, status) VALUES 
('Lumina AI Keyboard', 'A predictive typing assistant using advanced LLM integration directly onto your physical keyboard interface.', 'Hardware', 'In-Progress'),
('NexSync Cloud', 'Ultra-fast serverless file syncing optimized for large media and 3D rendering workflows.', 'Software', 'Live'),
('Nexus Watch App', 'A companion fitness and health application integrating with Nexus smart devices.', 'App', 'Planned');
