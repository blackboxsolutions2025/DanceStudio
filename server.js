require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer <token>"

    if (!token) return res.status(401).json({ message: 'Access denied. Please log in.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ message: 'Session expired. Please log in again.' });
        req.user = decodedUser;
        next();
    });
};

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, 'Pages')));
app.use('/Shared', express.static(path.join(__dirname, 'Pages', 'Shared')));
app.use('/LandingPage', express.static(path.join(__dirname, 'Pages', 'LandingPage')));

// --- Page Routes ---
app.get('/', (req, res) => {
    res.redirect('/LandingPage/LandingPage.html');
});

app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'LandingPage', 'LandingPage.html'));
});

app.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'Schedule', 'Schedule.html'));
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'Shop', 'Shop.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'LoginPage', 'LoginPage.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'LoginPage', 'LoginPage.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'SettingsPage', 'SettingsPage.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'AdminDashboardPage', 'AdminDashboardPage.html'));
});

// --- Database Connection Pool ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dancestudio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00', // Forces Philippine Time globally
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('connection', (connection) => {
    connection.execute("SET time_zone = '+08:00';");
});

// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const crypto = require('crypto');

// --- Signup Endpoint with Real Email Dispatch ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        
        // Check if user already exists
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Insert user as unverified
        await pool.execute(
            'INSERT INTO users (name, email, password, phone, status, verification_token) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, 'unverified', verificationToken]
        );

        // Build Confirmation Link
        const confirmLink = `http://localhost:3000/api/auth/verify?token=${verificationToken}`;

        // Send Real Email via Nodemailer
        await transporter.sendMail({
            from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
            to: email,
            subject: 'Confirm Your Email Address - Rhythm & Soul',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                    <h2 style="color: #10b981; margin-bottom: 10px;">Welcome to Rhythm & Soul, ${name}!</h2>
                    <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">We're thrilled to have you join our dance community. Please click the button below to verify your email address and activate your student account:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${confirmLink}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">Verify Email Address</a>
                    </div>
                    <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">If you didn't create an account with us, you can safely ignore this email.</p>
                </div>
            `
        });
        
        res.status(201).json({ 
            message: 'Account created successfully! Please check your email inbox for the confirmation link.'
        });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ message: 'Server error during signup or email dispatch.' });
    }
});

// --- Email Verification Endpoint ---
app.get('/api/auth/verify', async (req, res) => {
    try {
        const { token } = req.query;
        const [users] = await pool.execute('SELECT id FROM users WHERE verification_token = ?', [token]);

        if (users.length === 0) {
            return res.status(400).send('<h2>Invalid or expired verification link.</h2>');
        }

        // Fixed: Use ? placeholder for 'verified' instead of double quotes
        await pool.execute('UPDATE users SET status = ?, verification_token = NULL WHERE verification_token = ?', ['verified', token]);
        
        // Redirect to login page with success query
        res.redirect('/LoginPage/LoginPage.html?verified=true');
    } catch (err) {
        console.error('Verification Error:', err);
        res.status(500).send('Server error during verification.');
    }
});

// --- Login Endpoint ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const user = users[0];

        if (user.status !== 'verified') {
            return res.status(403).json({ message: 'Please verify your email address before logging in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role }, // <-- Added role here
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        let imageUrl = null;
        if (user.profile_image) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/${user.profile_image}`;
        }

        // Include 'role' in the login response
        res.json({ 
            message: 'Login successful', 
            token, 
            name: user.name, 
            role: user.role, 
            profileImage: imageUrl 
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- Forgot Password Request Endpoint ---
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await pool.execute('SELECT id, name FROM users WHERE email = ?', [email]);

        // Security best practice: Don't reveal whether the email exists, but send email if it does
        if (users.length > 0) {
            const user = users[0];
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = new Date(Date.now() + 3600000); // Valid for 1 hour

            await pool.execute(
                'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
                [resetToken, resetExpires, user.id]
            );

            const resetLink = `http://localhost:3000/ResetPasswordPage/ResetPasswordPage.html?token=${resetToken}`;

            await transporter.sendMail({
                from: `"Rhythm & Soul Dance Studio" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Password Reset Request - Rhythm & Soul',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                        <h2 style="color: #10b981; margin-bottom: 10px;">Password Reset Request</h2>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">Hello ${user.name}, we received a request to reset your password. Click the button below to choose a new password. This link is valid for 1 hour:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">Reset Password</a>
                        </div>
                        <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                `
            });
        }

        res.json({ message: 'If that email address is registered, a password reset link has been sent to your inbox.' });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ message: 'Server error during password reset request.' });
    }
});

// --- Password Reset Endpoint ---
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const [users] = await pool.execute(
            'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        }

        const user = users[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.execute(
            'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Password has been successfully updated. You can now log in.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

// --- Update User Password in Database ---
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Fetch current hashed password from database
        const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = users[0];

        // Verify current password with bcrypt
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password.' });
        }

        // Hash the new password securely
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update database record
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );

        res.json({ message: 'Password has been successfully updated.' });
    } catch (err) {
        console.error('Update Password Error:', err);
        res.status(500).json({ message: 'Server error while updating password.' });
    }
});

const multer = require('multer');

// --- Configure Multer Local Storage ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename: user-ID-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit to 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// --- Serve Uploads Folder Globally & Publicly ---
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- Updated Profile Get Endpoint (Returns real image URL) ---
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        // Select 'role' along with other profile fields
        const [users] = await pool.execute('SELECT name, email, phone, role, profile_image FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found.' });

        const user = users[0];
        
        let imageUrl = null;
        if (user.profile_image) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/${user.profile_image}`;
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role, // Returned to client
            profileImage: imageUrl
        });
    } catch (err) {
        console.error('Fetch Profile Error:', err);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

const fs = require('fs');

// --- Updated Profile Put Endpoint (Handles both text fields and file upload) ---
app.put('/api/user/profile', authenticateToken, upload.single('profileImage'), async (req, res) => {
    try {
        const { name, phone } = req.body;

        // 1. If a new file is uploaded, check for and delete the old profile image
        if (req.file) {
            const [existingUser] = await pool.execute('SELECT profile_image FROM users WHERE id = ?', [req.user.id]);
            if (existingUser.length > 0 && existingUser[0].profile_image) {
                const oldFilename = existingUser[0].profile_image;
                const oldFilePath = path.join(__dirname, 'public', 'uploads', oldFilename);

                // Check if the old file physically exists, then delete it
                if (fs.existsSync(oldFilePath)) {
                    fs.unlink(oldFilePath, (err) => {
                        if (err) console.error('Error deleting old profile image:', err);
                    });
                }
            }
        }

        // 2. Build the SQL update query
        let query = 'UPDATE users SET name = ?, phone = ?';
        let params = [name, phone];

        if (req.file) {
            query += ', profile_image = ?';
            params.push(req.file.filename);
        }

        query += ' WHERE id = ?';
        params.push(req.user.id);

        await pool.execute(query, params);

        // 3. Construct the dynamic public URL to return to the client
        let imageUrl = null;
        if (req.file) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        }

        res.json({ 
            message: 'Profile updated successfully!',
            profileImage: imageUrl
        });
    } catch (err) {
        console.error('Update Profile Error:', err);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

// --- Get All Classes with Filters ---
app.get('/api/classes', async (req, res) => {
    try {
        const { date, genre, coach } = req.query;
        let query = `
            SELECT c.*, g.name AS genre_name, ch.name AS coach_name, ch.profileimage AS coach_image, ch.classimage AS coach_class_image 
            FROM classes c 
            JOIN genre g ON c.genreid = g.id 
            JOIN coach ch ON c.coachid = ch.id 
            WHERE c.schedule_date >= CURDATE()
        `;
        let params = [];

        if (date) {
            query += ' AND c.schedule_date = ?';
            params.push(date);
        }
        if (genre) {
            query += ' AND c.genreid = ?';
            params.push(genre);
        }
        if (coach) {
            query += ' AND c.coachid = ?';
            params.push(coach);
        }

        query += ' ORDER BY c.schedule_date ASC, c.start_time ASC';

        const [classes] = await pool.execute(query, params);
        res.json(classes);
    } catch (err) {
        console.error('Fetch Classes Error:', err);
        res.status(500).json({ message: 'Server error while fetching classes.' });
    }
});

// --- Get All Genres for Filters ---
app.get('/api/genres', async (req, res) => {
    try {
        const [genres] = await pool.execute('SELECT id, name FROM genre ORDER BY name ASC');
        res.json(genres);
    } catch (err) {
        console.error('Fetch Genres Error:', err);
        res.status(500).json({ message: 'Server error while fetching genres.' });
    }
});

// --- Get All Coaches for Filters ---
app.get('/api/coaches', async (req, res) => {
    try {
        const [coaches] = await pool.execute('SELECT id, name FROM coach ORDER BY name ASC');
        res.json(coaches);
    } catch (err) {
        console.error('Fetch Coaches Error:', err);
        res.status(500).json({ message: 'Server error while fetching coaches.' });
    }
});

// --- Admin: Delete Coach & Associated Account ---
app.delete('/api/admin/coaches/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }
        const coachId = req.params.id;
        const [coach] = await pool.execute('SELECT user_id FROM coach WHERE id = ?', [coachId]);
        if (coach.length === 0) {
            return res.status(404).json({ message: 'Coach not found.' });
        }
        const userId = coach[0].user_id;
        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'Coach and associated user account successfully deleted.' });
    } catch (err) {
        console.error('Delete Coach Error:', err);
        res.status(500).json({ message: 'Server error while deleting coach.' });
    }
});

// --- Admin: Get All Coaches with User Details ---
app.get('/api/admin/coaches', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }

        const query = `
            SELECT c.id, c.name, u.profile_image AS profileimage, c.classimage, c.createdat, u.email, u.phone 
            FROM coach c 
            JOIN users u ON c.user_id = u.id 
            ORDER BY c.name ASC
        `;
        const [coaches] = await pool.execute(query);

        // Map image paths to full public URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedCoaches = coaches.map(coach => ({
            ...coach,
            profileimage: coach.profileimage ? `${baseUrl}/uploads/${coach.profileimage}` : null,
            classimage: coach.classimage ? `${baseUrl}/uploads/${coach.classimage}` : null
        }));

        res.json(formattedCoaches);
    } catch (err) {
        console.error('Fetch Coaches Error:', err);
        res.status(500).json({ message: 'Server error while fetching coaches.' });
    }
});

// --- Admin: Create Coach Endpoint ---
app.post('/api/admin/coaches', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }

        const { name, email, phone } = req.body;

        // Check if user already exists[cite: 2]
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }

        // Automatically hash default password '123456789'[cite: 2]
        const defaultPassword = '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Insert into users table with role 'coach' and unverified status
        const [userResult] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, status, role, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, 'unverified', 'coach', verificationToken]
        );

        const userId = userResult.insertId;

        // Insert into coach table linked via user_id[cite: 1]
        await pool.execute(
            'INSERT INTO coach (user_id, name) VALUES (?, ?)',
            [userId, name]
        );

        // Build Confirmation Link pointing to verification route[cite: 2]
        const confirmLink = `http://localhost:3000/api/auth/verify?token=${verificationToken}`;

        // Send Email via Nodemailer to the Coach[cite: 2]
        await transporter.sendMail({
            from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
            to: email,
            subject: 'Welcome Coach! Confirm Your Account - Rhythm & Soul',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                    <h2 style="color: #10b981; margin-bottom: 10px;">Welcome to the Team, Coach ${name}!</h2>
                    <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">An instructor account has been created for you at Rhythm & Soul Dance Studio. Your temporary default password is: <strong style="color: #ffffff;">123456789</strong></p>
                    <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">Please click the button below to verify your email address and activate your account:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${confirmLink}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">Verify Email & Login</a>
                    </div>
                    <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">We recommend updating your password in your settings after logging in.</p>
                </div>
            `
        });

        res.status(201).json({ message: 'Coach account successfully created and verification email sent!' });
    } catch (err) {
        console.error('Create Coach Error:', err);
        res.status(500).json({ message: 'Server error while creating coach or sending email.' });
    }
});









// --- Server Listener ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🚀 Dance Studio Server running on http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});