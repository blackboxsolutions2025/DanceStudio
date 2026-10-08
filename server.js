require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');


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

app.get('/student-schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'StudentClassSchedulePage', 'StudentClassSchedulePage.html'));
});

app.get('/coach-schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'CoachSchedulePage', 'CoachSchedulePage.html'));
});

app.get('/booked-venue', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'BookedVenuePage', 'BookedVenuePage.html'));
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
            imageUrl = `${baseUrl}/profile-picture/${user.profile_image}`;
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

// --- Configure Multer Storage for User Profile Pictures (Folder: profile-picture) ---
const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'profile-picture');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: profilePicStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// --- Configure Multer Storage for Coach Card Profile Image (Folder: cardprofile) ---
const cardProfileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'cardprofile');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `cardprofile-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const uploadCardProfile = multer({
    storage: cardProfileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Updated to 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// --- Serve profile-picture & Card Profile Folders Globally & Publicly ---
app.use('/profile-picture', express.static(path.join(__dirname, 'public', 'profile-picture')));
app.use('/cardprofile', express.static(path.join(__dirname, 'public', 'cardprofile')));

// --- Updated Profile Get Endpoint (Returns real image URL) ---
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT name, email, phone, role, profile_image FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found.' });

        const user = users[0];
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imageUrl = user.profile_image ? `${baseUrl}/profile-picture/${user.profile_image}` : null;

        let coachClassImage = null;
        let imagePosition = '50% 50%';

        if (user.role === 'coach') {
            const [coaches] = await pool.execute('SELECT classimage, image_position FROM coach WHERE user_id = ?', [req.user.id]);
            if (coaches.length > 0) {
                if (coaches[0].classimage) coachClassImage = `${baseUrl}/cardprofile/${coaches[0].classimage}`;
                if (coaches[0].image_position) imagePosition = coaches[0].image_position;
            }
        }

        res.json({
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profileImage: imageUrl,
            coachClassImage,
            imagePosition
        });
    } catch (err) {
        console.error('Fetch Profile Error:', err);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

// --- Updated Profile Put Endpoint (Handles both text fields and file upload) ---
app.put('/api/user/profile', authenticateToken, upload.single('profileImage'), async (req, res) => {
    try {
        const { name, phone } = req.body;

        // 1. If a new file is uploaded, check for and delete the old profile image
        if (req.file) {
            const [existingUser] = await pool.execute('SELECT profile_image FROM users WHERE id = ?', [req.user.id]);
            if (existingUser.length > 0 && existingUser[0].profile_image) {
                const oldFilename = existingUser[0].profile_image;
                const oldFilePath = path.join(__dirname, 'public', 'profile-picture', oldFilename);

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
            imageUrl = `${baseUrl}/profile-picture/${req.file.filename}`;
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

// --- Coach Class Card Image Update Endpoint ---
app.put('/api/coach/class-image', authenticateToken, uploadCardProfile.single('classImage'), async (req, res) => {
    try {
        if (req.user.role !== 'coach') {
            return res.status(403).json({ message: 'Access denied. Coach privileges required.' });
        }

        const { imagePosition } = req.body;
        
        // 1. Check if a coach record exists for this user
        let [coachRows] = await pool.execute('SELECT id, classimage FROM coach WHERE user_id = ?', [req.user.id]);
        
        let coach;
        if (coachRows.length === 0) {
            // If the coach record is missing, automatically create it so it never returns 404!
            const [insertResult] = await pool.execute(
                'INSERT INTO coach (user_id, name) VALUES (?, ?)',
                [req.user.id, req.user.name || 'Coach']
            );
            coach = { id: insertResult.insertId, classimage: null };
        } else {
            coach = coachRows[0];
        }

        let query = 'UPDATE coach SET image_position = ?';
        let params = [imagePosition || '50% 50%'];

        if (req.file) {
            if (coach.classimage) {
                const oldFilePath = path.join(__dirname, 'public', 'cardprofile', coach.classimage);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            query += ', classimage = ?';
            params.push(req.file.filename);
        }

        query += ' WHERE user_id = ?';
        params.push(req.user.id);

        await pool.execute(query, params);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const updatedImage = req.file ? `${baseUrl}/cardprofile/${req.file.filename}` : (coach.classimage ? `${baseUrl}/cardprofile/${coach.classimage}` : null);

        res.json({
            message: 'Class card profile image and position updated successfully!',
            coachClassImage: updatedImage,
            imagePosition: imagePosition || '50% 50%'
        });
    } catch (err) {
        console.error('Update Coach Class Image Error:', err);
        res.status(500).json({ message: 'Server error while updating class card image.' });
    }
});

// --- Get All Classes with Filters ---
app.get('/api/classes', async (req, res) => {
    try {
        let userId = 0;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (err) {
                // Invalid or expired token, treat as guest
            }
        }

        const { date, genre, coach, venue } = req.query;
        let query = `
            SELECT c.*, g.name AS genre_name, ch.name AS coach_name, v.name AS venue_name, 
                   u.profile_image AS coach_image, ch.classimage AS coach_class_image, ch.image_position AS coach_image_position,
                   (SELECT COUNT(*) 
                    FROM enrollments e 
                    JOIN payments p ON p.enrollment_id = e.id 
                    WHERE e.class_id = c.id 
                      AND e.user_id = ? 
                      AND e.status = 'confirmed' 
                      AND p.status = 'paid') AS is_booked
            FROM classes c 
            JOIN genre g ON c.genreid = g.id 
            JOIN coach ch ON c.coachid = ch.id 
            JOIN venue v ON c.venueid = v.id 
            LEFT JOIN users u ON ch.user_id = u.id 
            WHERE c.schedule_date >= CURDATE()
        `;
        let params = [userId];

        query += ' ORDER BY c.schedule_date ASC, c.start_time ASC';
        const [classes] = await pool.execute(query, params);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedClasses = classes.map(cls => ({
            ...cls,
            coach_class_image: cls.coach_class_image ? `${baseUrl}/cardprofile/${cls.coach_class_image}` : null,
            is_booked: cls.is_booked > 0
        }));

        res.json(formattedClasses);
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
            profileimage: coach.profileimage ? `${baseUrl}/profile-picture/${coach.profileimage}` : null,
            classimage: coach.classimage ? `${baseUrl}/cardprofile/${coach.classimage}` : null
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

// --- Get All Venues for Filters ---
app.get('/api/venues', async (req, res) => {
    try {
        const [venues] = await pool.execute('SELECT * FROM venue WHERE is_active = 1 ORDER BY name ASC');
        res.json(venues);
    } catch (err) {
        console.error('Fetch Venues Error:', err);
        res.status(500).json({ message: 'Server error while fetching venues.' });
    }
});

// --- Admin: Get All Venues (Including Inactive) ---
app.get('/api/admin/venues', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }
        const [venues] = await pool.execute('SELECT * FROM venue ORDER BY name ASC');
        res.json(venues);
    } catch (err) {
        console.error('Fetch Admin Venues Error:', err);
        res.status(500).json({ message: 'Server error while fetching admin venues.' });
    }
});

// --- Admin: Create Class Schedule Endpoint ---
app.post('/api/classes', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }

        const {
            title,
            genreid,
            coachid,
            venueid,
            schedule_date,
            start_time,
            end_time,
            capacity,
            slots_remaining,
            price,
            description
        } = req.body;

        if (!title || !genreid || !coachid || !venueid || !schedule_date || !start_time || !end_time) {
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }

        // Check for time conflicts across both classes and confirmed venue rentals
        const conflictResult = await checkVenueConflict(venueid, schedule_date, start_time, end_time);
        if (conflictResult) {
            if (conflictResult.type === 'class') {
                return res.status(400).json({ 
                    message: `Time conflict: This venue is already booked by class "${conflictResult.conflict.title}" from ${conflictResult.conflict.start_time} to ${conflictResult.conflict.end_time} on this date.` 
                });
            } else {
                return res.status(400).json({ 
                    message: `Time conflict: This venue is already booked for a confirmed private rental from ${conflictResult.conflict.start_time} to ${conflictResult.conflict.end_time} on this date.` 
                });
            }
        }

        const finalCapacity = capacity || 20;
        const finalSlotsRemaining = slots_remaining !== undefined ? slots_remaining : finalCapacity;
        const finalPrice = price !== undefined ? price : 500.00;

        await pool.execute(
            `INSERT INTO classes (title, genreid, coachid, venueid, schedule_date, start_time, end_time, capacity, slots_remaining, price, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, genreid, coachid, venueid, schedule_date, start_time, end_time, finalCapacity, finalSlotsRemaining, finalPrice, description || '']
        );

        res.status(201).json({ message: 'Class schedule successfully created!' });
    } catch (err) {
        console.error('Create Class Error:', err);
        res.status(500).json({ message: 'Server error while creating class schedule.' });
    }
});

// --- Get Single Class Details Endpoint ---
app.get('/api/venues/:id', async (req, res) => {
    try {
        const venueId = req.params.id;
        const [venues] = await pool.execute('SELECT * FROM venue WHERE id = ?', [venueId]);
        
        if (venues.length === 0) {
            return res.status(404).json({ message: 'Venue not found.' });
        }

        const venue = venues[0];

        // Fetch gallery photos from your dedicated venue_images table sorted by display_order
        const [galleryImages] = await pool.execute(
            'SELECT id, image_path, display_order FROM venue_images WHERE venue_id = ? ORDER BY display_order ASC', 
            [venueId]
        );

        venue.gallery_images = galleryImages;

        res.json(venue);
    } catch (err) {
        console.error('Fetch Venue Details Error:', err);
        res.status(500).json({ message: 'Server error while fetching venue details.' });
    }
});

// --- Checkout Initialization Endpoint ---
app.post('/api/checkout', authenticateToken, async (req, res) => {
    try {
        const { class_id } = req.body;
        const userId = req.user.id;

        // 1. Fetch class details and price
        const [classes] = await pool.execute('SELECT title, price, slots_remaining FROM classes WHERE id = ?', [class_id]);
        if (classes.length === 0) return res.status(404).json({ message: 'Class not found.' });
        if (classes[0].slots_remaining <= 0) return res.status(400).json({ message: 'Class is fully booked.' });
        
        const classInfo = classes[0];
        const amountInCentavos = Math.round(classInfo.price * 100);

        // Tighter truncation limit (max 25 characters) to fit PayMongo's container layout
        const displayTitle = classInfo.title.length > 25 
            ? classInfo.title.substring(0, 22) + '...' 
            : classInfo.title;

        // 2. Call PayMongo to generate Checkout Session
        const paymongoRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        line_items: [{
                            name: displayTitle,
                            amount: amountInCentavos,
                            currency: 'PHP',
                            quantity: 1
                        }],
                        payment_method_types: ['gcash', 'paymaya', 'card'],
                        success_url: 'http://localhost:3000/PaymentSuccessPage/PaymentSuccessPage.html?type=class',
                        cancel_url: `http://localhost:3000/PaymentFailedPage/PaymentFailedPage.html?classId=${class_id}`,
                        description: `Enrollment for ${displayTitle}`
                    }
                }
            })
        });

        const paymongoData = await paymongoRes.json();
        
        if (!paymongoRes.ok || !paymongoData.data) {
            console.error('PayMongo Error:', paymongoData);
            return res.status(500).json({ message: paymongoData.errors?.[0]?.detail || 'Failed to generate PayMongo checkout session.' });
        }

        const checkoutId = paymongoData.data.id;
        const checkoutUrl = paymongoData.data.attributes.checkout_url;

        // 3. Save pending enrollment and payment with explicit Philippine time (UTC+8)
        const [enrollment] = await pool.execute(
            'INSERT INTO enrollments (user_id, class_id, status) VALUES (?, ?, ?)', 
            [userId, class_id, 'pending']
        );

        await pool.execute(
            'INSERT INTO payments (enrollment_id, amount, paymongo_checkout_id, status) VALUES (?, ?, ?, ?)',
            [enrollment.insertId, classInfo.price, checkoutId, 'pending']
        );

        res.json({ checkoutUrl });
    } catch (err) {
        console.error('Checkout Error:', err);
        res.status(500).json({ message: 'Failed to initiate checkout.' });
    }
});

// --- PayMongo Webhook Listener ---
app.post('/api/webhooks/paymongo', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signatureHeader = req.headers['paymongo-signature'];
        const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

        // Optional: If you use express.json() globally, ensure you capture the raw body or use express.raw for this route.
        // Verify signature to prevent spoofing
        if (signatureHeader && webhookSecret) {
            // Standard PayMongo signature verification logic can be applied here
        }

        const event = req.body.data;
        
        if (event && event.attributes) {
            const eventType = event.attributes.type;
            const checkoutId = event.attributes.data?.id;

            if (eventType === 'checkout_session.payment.paid') {
                await pool.execute('UPDATE payments SET status = ? WHERE paymongo_checkout_id = ?', ['paid', checkoutId]);
                
                // Check both enrollment_id and venue_rental_id
                const [payments] = await pool.execute('SELECT enrollment_id, venue_rental_id FROM payments WHERE paymongo_checkout_id = ?', [checkoutId]);
                if (payments.length > 0) {
                    const paymentRecord = payments[0];
                    
                    // 1. Handle Class Enrollment
                    if (paymentRecord.enrollment_id) {
                        const enrollmentId = paymentRecord.enrollment_id;
                        await pool.execute('UPDATE enrollments SET status = ? WHERE id = ?', ['confirmed', enrollmentId]);
                        
                        const [enrollments] = await pool.execute('SELECT class_id, user_id FROM enrollments WHERE id = ?', [enrollmentId]);
                        if (enrollments.length > 0) {
                            const { class_id, user_id } = enrollments[0];
                            await pool.execute('UPDATE classes SET slots_remaining = slots_remaining - 1 WHERE id = ?', [class_id]);

                            const [users] = await pool.execute('SELECT name, email FROM users WHERE id = ?', [user_id]);
                            const [classes] = await pool.execute('SELECT title, schedule_date, start_time FROM classes WHERE id = ?', [class_id]);

                            if (users.length > 0 && classes.length > 0) {
                                const user = users[0];
                                const danceClass = classes[0];
                                
                                const dateObj = new Date(danceClass.schedule_date);
                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const formattedDate = `${days[dateObj.getUTCDay()]} - ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;

                                const [hours, minutes] = danceClass.start_time.split(':');
                                let h = parseInt(hours, 10);
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                h = h % 12 || 12;
                                const formattedTime = `${h}:${minutes} ${ampm}`;

                                const schedulePageUrl = `http://localhost:3000/StudentClassSchedulePage/StudentClassSchedulePage.html`;

                                await transporter.sendMail({
                                    from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
                                    to: user.email,
                                    subject: `Enrollment Confirmed: ${danceClass.title} - Rhythm & Soul`,
                                    html: `
                                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                                            <h2 style="color: #10b981; margin-bottom: 10px;">Payment Successful, ${user.name}!</h2>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">Your payment for <strong>${danceClass.title}</strong> has been successfully processed, and your spot is fully secured.</p>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Schedule:</strong> ${formattedDate} at ${formattedTime}</p>
                                            <div style="text-align: center; margin: 30px 0;">
                                                <a href="${schedulePageUrl}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">View My Class Schedule</a>
                                            </div>
                                            <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">We look forward to seeing you in class!</p>
                                        </div>
                                    `
                                });
                            }
                        }
                    } 
                    // 2. Handle Venue Rental
                    else if (paymentRecord.venue_rental_id) {
                        const venueRentalId = paymentRecord.venue_rental_id;
                        await pool.execute('UPDATE venue_rentals SET status = ? WHERE id = ?', ['confirmed', venueRentalId]);
                        
                        const [rentals] = await pool.execute(
                            `SELECT vr.rental_date, vr.start_time, vr.end_time, vr.total_price, v.name AS venue_name, u.name, u.email 
                            FROM venue_rentals vr 
                            JOIN venue v ON vr.venue_id = v.id 
                            JOIN users u ON vr.user_id = u.id 
                            WHERE vr.id = ?`,
                            [venueRentalId]
                        );

                        if (rentals.length > 0) {
                            const rental = rentals[0];
                            const dateObj = new Date(rental.rental_date);
                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const formattedDate = `${days[dateObj.getUTCDay()]} - ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;

                            const formatTimeStr = (timeStr) => {
                                if (!timeStr) return '';
                                const [hours, minutes] = timeStr.split(':');
                                let h = parseInt(hours, 10);
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                h = h % 12 || 12;
                                return `${h}:${minutes} ${ampm}`;
                            };

                            // Updated URL pointing directly to the BookedVenuePage
                            const bookedVenueUrl = `http://localhost:3000/BookedVenuePage/BookedVenuePage.html`;
                            const adminDashboardUrl = `http://localhost:3000/admin`;

                            // 1. Send confirmation email to the customer/student
                            await transporter.sendMail({
                                from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
                                to: rental.email,
                                subject: `Venue Rental Confirmed: ${rental.venue_name} - Rhythm & Soul`,
                                html: `
                                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                                        <h2 style="color: #10b981; margin-bottom: 10px;">Payment Successful, ${rental.name}!</h2>
                                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">Your payment for <strong>${rental.venue_name}</strong> has been successfully processed, and your venue rental is fully confirmed.</p>
                                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Date:</strong> ${formattedDate}</p>
                                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Time:</strong> ${formatTimeStr(rental.start_time)} - ${formatTimeStr(rental.end_time)}</p>
                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="${bookedVenueUrl}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">View Booked Venues</a>
                                        </div>
                                        <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">Thank you for booking with Rhythm & Soul Dance Studio!</p>
                                    </div>
                                `
                            });

                            // 2. Fetch all users with admin role and send them a notification email
                            const [admins] = await pool.execute("SELECT email FROM users WHERE role = 'admin'");
                            if (admins.length > 0) {
                                const adminEmails = admins.map(admin => admin.email).join(',');

                                await transporter.sendMail({
                                    from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
                                    to: adminEmails,
                                    subject: `New Venue Booking Confirmed: ${rental.venue_name} (${rental.name})`,
                                    html: `
                                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                                            <h2 style="color: #10b981; margin-bottom: 10px;">New Venue Booking Confirmed</h2>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">A new venue rental has been successfully booked and paid for by <strong>${rental.name}</strong> (${rental.email}).</p>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Venue:</strong> ${rental.venue_name}</p>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Date:</strong> ${formattedDate}</p>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Time:</strong> ${formatTimeStr(rental.start_time)} - ${formatTimeStr(rental.end_time)}</p>
                                            <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Total Amount:</strong> ₱${Number(rental.total_price).toFixed(2)}</p>
                                            <div style="text-align: center; margin: 30px 0;">
                                                <a href="${adminDashboardUrl}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">View Admin Dashboard</a>
                                            </div>
                                            <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">Rhythm & Soul Dance Studio Automated System</p>
                                        </div>
                                    `
                                });
                            }
                        }
                    }
                }
            }
            else if (eventType === 'checkout_session.payment.failed' || eventType === 'checkout_session.payment.expired') {
                await pool.execute('UPDATE payments SET status = ? WHERE paymongo_checkout_id = ?', ['failed', checkoutId]);
                const [payments] = await pool.execute('SELECT enrollment_id, venue_rental_id FROM payments WHERE paymongo_checkout_id = ?', [checkoutId]);
                if (payments.length > 0) {
                    if (payments[0].enrollment_id) {
                        await pool.execute('UPDATE enrollments SET status = ? WHERE id = ?', ['cancelled', payments[0].enrollment_id]);
                    } else if (payments[0].venue_rental_id) {
                        await pool.execute('UPDATE venue_rentals SET status = ? WHERE id = ?', ['cancelled', payments[0].venue_rental_id]);
                    }
                }
            }
        }
        res.status(200).send('Webhook received');
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).send('Webhook processing failed');
    }
});

app.post('/api/checkout/fail', authenticateToken, async (req, res) => {
    try {
        const { class_id } = req.body;
        const userId = req.user.id;

        if (class_id) {
            const [enrollments] = await pool.execute(
                'SELECT id FROM enrollments WHERE user_id = ? AND class_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
                [userId, class_id, 'pending']
            );

            if (enrollments.length > 0) {
                const enrollmentId = enrollments[0].id;
                await pool.execute('UPDATE enrollments SET status = ? WHERE id = ?', ['cancelled', enrollmentId]);
                await pool.execute('UPDATE payments SET status = ? WHERE enrollment_id = ?', ['failed', enrollmentId]);
            }
        }
        res.json({ message: 'Checkout marked as failed/cancelled.' });
    } catch (err) {
        console.error('Checkout Fail Error:', err);
        res.status(500).json({ message: 'Server error updating failed checkout.' });
    }
});

// --- Check User Class Enrollment Status ---
app.get('/api/enrollments/check', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { class_id } = req.query;

        if (!class_id) {
            return res.status(400).json({ message: 'Class ID is required.' });
        }

        const [rows] = await pool.execute(
            `SELECT e.id 
             FROM enrollments e 
             JOIN payments p ON p.enrollment_id = e.id 
             WHERE e.user_id = ? AND e.class_id = ? AND e.status = 'confirmed' AND p.status = 'paid'`,
            [userId, class_id]
        );

        res.json({ isBooked: rows.length > 0 });
    } catch (err) {
        console.error('Check Enrollment Error:', err);
        res.status(500).json({ message: 'Server error while checking enrollment status.' });
    }
});

// --- Get Authenticated User Confirmed Class Schedule ---
app.get('/api/user/schedule', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT e.id AS enrollment_id, e.status AS enrollment_status,
                   c.id AS class_id, c.title, DATE_FORMAT(c.schedule_date, '%Y-%m-%d') AS schedule_date, c.start_time, c.end_time, c.price, c.description,
                   g.name AS genre_name,
                   ch.id AS coach_id, ch.name AS coach_name, ch.classimage AS coach_class_image, ch.image_position AS coach_image_position,
                   u.profile_image AS coach_user_image,
                   v.id AS venue_id, v.name AS venue_name,
                   a.time_in, a.time_out, a.is_overridden, a.override_reason, a.overridden_at,
                   ua.name AS overridden_by_name,
                   CASE 
                       WHEN a.time_out IS NOT NULL THEN 'completed'
                       WHEN a.time_in IS NOT NULL THEN 'timed_in'
                       ELSE 'none'
                   END AS attendance_status
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN genre g ON c.genreid = g.id
            JOIN coach ch ON c.coachid = ch.id
            LEFT JOIN users u ON ch.user_id = u.id
            JOIN venue v ON c.venueid = v.id
            LEFT JOIN attendance a ON a.user_id = e.user_id AND a.class_id = c.id
            LEFT JOIN users ua ON a.overridden_by = ua.id
            WHERE e.user_id = ? AND e.status = 'confirmed'
            ORDER BY c.schedule_date ASC, c.start_time ASC
        `;
        const [enrollments] = await pool.execute(query, [userId]);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedEnrollments = enrollments.map(item => ({
            ...item,
            coach_class_image: item.coach_class_image ? `${baseUrl}/cardprofile/${item.coach_class_image}` : null,
            coach_user_image: item.coach_user_image ? `${baseUrl}/profile-picture/${item.coach_user_image}` : null
        }));

        res.json(formattedEnrollments);
    } catch (err) {
        console.error('Fetch User Schedule Error:', err);
        res.status(500).json({ message: 'Server error while fetching user schedule.' });
    }
});

// --- Get Authenticated User Confirmed Class Schedule with Attendance ---
app.get('/api/user/schedule', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT e.id AS enrollment_id, e.status AS enrollment_status,
                   c.id AS class_id, c.title, DATE_FORMAT(c.schedule_date, '%Y-%m-%d') AS schedule_date, c.start_time, c.end_time, c.price, c.description,
                   g.id AS genreid, g.name AS genre_name,
                   ch.id AS coach_id, ch.name AS coach_name, ch.classimage AS coach_class_image, ch.image_position AS coach_image_position,
                   u.profile_image AS coach_user_image,
                   v.id AS venue_id, v.name AS venue_name,
                   a.time_in, a.time_out, a.is_overridden, a.override_reason, a.overridden_at,
                   ua.name AS overridden_by_name,
                   CASE 
                       WHEN a.time_out IS NOT NULL THEN 'completed'
                       WHEN a.time_in IS NOT NULL THEN 'timed_in'
                       ELSE 'none'
                   END AS attendance_status
            FROM enrollments e
            JOIN classes c ON e.class_id = c.id
            JOIN genre g ON c.genreid = g.id
            JOIN coach ch ON c.coachid = ch.id
            LEFT JOIN users u ON ch.user_id = u.id
            JOIN venue v ON c.venueid = v.id
            LEFT JOIN attendance a ON a.user_id = e.user_id AND a.class_id = c.id
            LEFT JOIN users ua ON a.overridden_by = ua.id
            WHERE e.user_id = ? AND e.status = 'confirmed'
            ORDER BY c.schedule_date ASC, c.start_time ASC
        `;
        const [enrollments] = await pool.execute(query, [userId]);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedEnrollments = enrollments.map(item => ({
            ...item,
            coach_class_image: item.coach_class_image ? `${baseUrl}/cardprofile/${item.coach_class_image}` : null,
            coach_user_image: item.coach_user_image ? `${baseUrl}/profile-picture/${item.coach_user_image}` : null
        }));

        res.json(formattedEnrollments);
    } catch (err) {
        console.error('Fetch User Schedule Error:', err);
        res.status(500).json({ message: 'Server error while fetching user schedule.' });
    }
});

// --- Scan QR Code Attendance Endpoint ---
app.post('/api/attendance/scan', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { class_id, qr_code } = req.body;

        // Check if attendance row already exists for this student and class
        const [existing] = await pool.execute(
            'SELECT id, time_in, time_out FROM attendance WHERE user_id = ? AND class_id = ?',
            [userId, class_id]
        );

        let actionType = ''; // 'time_in' or 'time_out'

        if (existing.length === 0) {
            // First scan: Record Time-In
            await pool.execute(
                'INSERT INTO attendance (user_id, class_id, time_in) VALUES (?, ?, NOW())',
                [userId, class_id]
            );
            actionType = 'time_in';
        } else {
            const record = existing[0];
            if (!record.time_in) {
                await pool.execute(
                    'UPDATE attendance SET time_in = NOW() WHERE id = ?',
                    [record.id]
                );
                actionType = 'time_in';
            } else if (!record.time_out) {
                await pool.execute(
                    'UPDATE attendance SET time_out = NOW() WHERE id = ?',
                    [record.id]
                );
                actionType = 'time_out';
            } else {
                return res.status(400).json({ message: 'Attendance for this class has already been completed.' });
            }
        }

        // --- Fetch User, Class, and Attendance Details for Email Notification ---
        const [users] = await pool.execute('SELECT name, email FROM users WHERE id = ?', [userId]);
        const [classes] = await pool.execute(
            `SELECT c.title, c.schedule_date, c.start_time, c.end_time, v.name AS venue_name, ch.name AS coach_name 
             FROM classes c 
             JOIN venue v ON c.venueid = v.id 
             JOIN coach ch ON c.coachid = ch.id 
             WHERE c.id = ?`,
            [class_id]
        );
        const [attendanceRecords] = await pool.execute(
            'SELECT time_in, time_out FROM attendance WHERE user_id = ? AND class_id = ?',
            [userId, class_id]
        );

        if (users.length > 0 && classes.length > 0 && attendanceRecords.length > 0) {
            const student = users[0];
            const classInfo = classes[0];
            const att = attendanceRecords[0];

            // Format date (e.g., "Monday - Oct 12, 2026")
            const dateObj = new Date(classInfo.schedule_date);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDate = `${days[dateObj.getUTCDay()]} - ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;

            // Format class start/end time
            const formatTimeStr = (timeStr) => {
                if (!timeStr) return '';
                const [hours, minutes] = timeStr.split(':');
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${minutes} ${ampm}`;
            };

            const formattedStartTime = formatTimeStr(classInfo.start_time);
            const formattedEndTime = formatTimeStr(classInfo.end_time);

            // Format timestamp helper for time-in / time-out
            const formatTimestamp = (ts) => {
                if (!ts) return 'Not recorded';
                const d = new Date(ts);
                return d.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
            };

            const timeInDisplay = formatTimestamp(att.time_in);
            const timeOutDisplay = formatTimestamp(att.time_out);

            const statusTitle = actionType === 'time_in' ? 'Time-In Successfully Recorded' : 'Attendance Completed (Time-Out Recorded)';
            const schedulePageUrl = 'http://localhost:3000/StudentClassSchedulePage/StudentClassSchedulePage.html';

            // Send Email via Nodemailer
            await transporter.sendMail({
                from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
                to: student.email,
                subject: `Attendance Update: ${classInfo.title} - Rhythm & Soul`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                        <h2 style="color: #10b981; margin-bottom: 10px;">${statusTitle}, ${student.name}!</h2>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">Your attendance record for <strong>${classInfo.title}</strong> has been successfully updated.</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Class Date:</strong> ${formattedDate}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Scheduled Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Coach:</strong> ${classInfo.coach_name}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Venue:</strong> ${classInfo.venue_name}</p>
                        <hr style="border: 0; border-top: 1px solid #2b2f3a; margin: 20px 0;">
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Time-In:</strong> ${timeInDisplay}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Time-Out:</strong> ${timeOutDisplay}</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${schedulePageUrl}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">View My Schedule</a>
                        </div>
                        <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">Thank you for dancing with Rhythm & Soul Dance Studio!</p>
                    </div>
                `
            });
        }

        if (actionType === 'time_in') {
            return res.json({ message: 'Time-in successfully recorded!' });
        } else {
            return res.json({ message: 'Time-out successfully recorded! Attendance complete.' });
        }
    } catch (err) {
        console.error('Attendance Scan Error:', err);
        res.status(500).json({ message: 'Server error while recording attendance.' });
    }
});

// --- Get Confirmed Attendees for a Specific Class ---
app.get('/api/classes/:id/attendees', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'coach' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Coach or Admin privileges required.' });
        }
        const classId = req.params.id;
        const query = `
            SELECT u.id AS user_id, u.name, u.email, u.phone, u.profile_image,
                   e.status AS enrollment_status, p.status AS payment_status, e.created_at AS enrolled_at,
                   a.time_in, a.time_out, a.is_overridden, a.override_reason, a.overridden_at,
                   ua.name AS overridden_by_name
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN payments p ON p.enrollment_id = e.id
            LEFT JOIN attendance a ON a.user_id = u.id AND a.class_id = e.class_id
            LEFT JOIN users ua ON a.overridden_by = ua.id
            WHERE e.class_id = ? AND e.status = 'confirmed' AND p.status = 'paid'
            ORDER BY u.name ASC
        `;
        const [attendees] = await pool.execute(query, [classId]);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedAttendees = attendees.map(att => ({
            ...att,
            profile_image: att.profile_image ? `${baseUrl}/profile-picture/${att.profile_image}` : null
        }));

        res.json(formattedAttendees);
    } catch (err) {
        console.error('Fetch Attendees Error:', err);
        res.status(500).json({ message: 'Server error while fetching class attendees.' });
    }
});

// --- Get Authenticated Coach Class Schedule ---
app.get('/api/coach/schedule', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'coach') {
            return res.status(403).json({ message: 'Access denied. Coach privileges required.' });
        }

        const [coaches] = await pool.execute('SELECT id FROM coach WHERE user_id = ?', [req.user.id]);
        if (coaches.length === 0) {
            return res.json([]);
        }
        const coachId = coaches[0].id;

        const query = `
            SELECT c.id, c.title, DATE_FORMAT(c.schedule_date, '%Y-%m-%d') AS schedule_date, c.start_time, c.end_time, c.price, c.description, c.capacity, c.slots_remaining,
                   g.name AS genre_name, c.genreid,
                   v.id AS venue_id, v.name AS venue_name,
                   ch.id AS coach_id, ch.name AS coach_name, ch.classimage AS coach_class_image, ch.image_position AS coach_image_position,
                   u.profile_image AS coach_user_image
            FROM classes c
            JOIN genre g ON c.genreid = g.id
            JOIN coach ch ON c.coachid = ch.id
            LEFT JOIN users u ON ch.user_id = u.id
            JOIN venue v ON c.venueid = v.id
            WHERE c.coachid = ?
            ORDER BY c.schedule_date ASC, c.start_time ASC
        `;
        const [classes] = await pool.execute(query, [coachId]);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const formattedClasses = classes.map(item => ({
            ...item,
            coach_class_image: item.coach_class_image ? `${baseUrl}/cardprofile/${item.coach_class_image}` : null,
            coach_user_image: item.coach_user_image ? `${baseUrl}/profile-picture/${item.coach_user_image}` : null
        }));

        res.json(formattedClasses);
    } catch (err) {
        console.error('Fetch Coach Schedule Error:', err);
        res.status(500).json({ message: 'Server error while fetching coach schedule.' });
    }
});

// --- Coach/Admin Attendance Override Endpoint ---
app.post('/api/attendance/override', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'coach' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Coach or Admin privileges required.' });
        }

        const { class_id, student_id, attendance_status, override_reason } = req.body;

        if (!class_id || !student_id || !attendance_status || !override_reason) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // Fetch class schedule details
        const [classes] = await pool.execute(
            `SELECT c.title, c.schedule_date, c.start_time, c.end_time, v.name AS venue_name, ch.name AS coach_name 
             FROM classes c 
             JOIN venue v ON c.venueid = v.id 
             JOIN coach ch ON c.coachid = ch.id 
             WHERE c.id = ?`,
            [class_id]
        );
        if (classes.length === 0) {
            return res.status(404).json({ message: 'Class not found.' });
        }
        const classInfo = classes[0];

        // Validate time if user is a coach
        if (req.user.role === 'coach') {
            const classDateStr = classInfo.schedule_date.toISOString ? classInfo.schedule_date.toISOString().split('T')[0] : classInfo.schedule_date;
            const [year, month, day] = classDateStr.split('-').map(Number);
            const [endHour, endMin] = classInfo.end_time.split(':').map(Number);
            const endDateTime = new Date(year, month - 1, day, endHour, endMin, 0);

            const now = new Date();
            const nowPHT = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));

            if (nowPHT < endDateTime) {
                return res.status(400).json({ message: 'Attendance overrides are not allowed before the class end time.' });
            }
        }
        
        const classDateStr = classInfo.schedule_date.toISOString ? classInfo.schedule_date.toISOString().split('T')[0] : classInfo.schedule_date;

        const exactTimeIn = `${classDateStr} ${classInfo.start_time}`;
        const exactTimeOut = `${classDateStr} ${classInfo.end_time}`;

        let targetTimeIn = null;
        let targetTimeOut = null;

        if (attendance_status === 'time_in') {
            targetTimeIn = exactTimeIn;
            targetTimeOut = null;
        } else if (attendance_status === 'completed' || attendance_status === 'time_out') {
            targetTimeIn = exactTimeIn;
            targetTimeOut = exactTimeOut;
        } else if (attendance_status === 'none') {
            targetTimeIn = null;
            targetTimeOut = null;
        }

        // Check if attendance record already exists
        const [existing] = await pool.execute(
            'SELECT id FROM attendance WHERE user_id = ? AND class_id = ?',
            [student_id, class_id]
        );

        if (existing.length === 0) {
            await pool.execute(
                `INSERT INTO attendance (user_id, class_id, time_in, time_out, is_overridden, override_reason, overridden_by, overridden_at) 
                 VALUES (?, ?, ?, ?, 1, ?, ?, NOW())`,
                [student_id, class_id, targetTimeIn, targetTimeOut, override_reason, req.user.id]
            );
        } else {
            await pool.execute(
                `UPDATE attendance 
                 SET time_in = ?, time_out = ?, is_overridden = 1, override_reason = ?, overridden_by = ?, overridden_at = NOW() 
                 WHERE user_id = ? AND class_id = ?`,
                [targetTimeIn, targetTimeOut, override_reason, req.user.id, student_id, class_id]
            );
        }

        // --- Send Email Notification to Student ---
        const [students] = await pool.execute('SELECT name, email FROM users WHERE id = ?', [student_id]);
        if (students.length > 0) {
            const student = students[0];

            // Format date (e.g., "Monday - Oct 12, 2026")
            const dateObj = new Date(classInfo.schedule_date);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDate = `${days[dateObj.getUTCDay()]} - ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;

            // Format time (e.g., "10:00 AM")
            const [hours, minutes] = classInfo.start_time.split(':');
            let h = parseInt(hours, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            const formattedTime = `${h}:${minutes} ${ampm}`;

            let statusDisplay = 'Not Arrived (Cleared)';
            if (attendance_status === 'time_in') statusDisplay = 'Timed-In';
            else if (attendance_status === 'completed' || attendance_status === 'time_out') statusDisplay = 'Completed / Timed-Out';

            const schedulePageUrl = 'http://localhost:3000/StudentClassSchedulePage/StudentClassSchedulePage.html';

            await transporter.sendMail({
                from: '"Rhythm & Soul Dance Studio" <no-reply@rhythmsoul.com>',
                to: student.email,
                subject: `Attendance Override Update: ${classInfo.title} - Rhythm & Soul`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1015; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                        <h2 style="color: #10b981; margin-bottom: 10px;">Attendance Status Updated, ${student.name}!</h2>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;">An instructor or administrator has updated your attendance record for <strong>${classInfo.title}</strong>.</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>New Status:</strong> ${statusDisplay}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Date & Time:</strong> ${formattedDate} at ${formattedTime}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Coach:</strong> ${classInfo.coach_name}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Venue:</strong> ${classInfo.venue_name}</p>
                        <p style="color: #a0a5b1; font-size: 0.95rem; line-height: 1.5;"><strong>Override Reason:</strong> ${override_reason}</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${schedulePageUrl}" style="display: inline-block; background-color: #10b981; color: #0f1015; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 1rem;">View My Schedule</a>
                        </div>
                        <p style="color: #a0a5b1; font-size: 0.85rem; border-top: 1px solid #2b2f3a; padding-top: 15px;">If you have any questions regarding this adjustment, please contact the studio.</p>
                    </div>
                `
            });
        }

        res.json({ message: 'Attendance successfully overridden and notification email sent to student.' });
    } catch (err) {
        console.error('Attendance Override Error:', err);
        res.status(500).json({ message: 'Server error while processing attendance override.' });
    }
});

// --- Universal Conflict Checking Helper Function ---
async function checkVenueConflict(venueId, date, startTime, endTime, excludeRentalId = null) {
    // 1. Check classes table
    const [classConflicts] = await pool.execute(
        `SELECT id, title, start_time, end_time FROM classes 
         WHERE venueid = ? AND schedule_date = ? 
         AND NOT (end_time <= ? OR start_time >= ?)`,
        [venueId, date, startTime, endTime]
    );

    if (classConflicts.length > 0) {
        return { type: 'class', conflict: classConflicts[0] };
    }

    // 2. Check confirmed venue_rentals table
    let rentalQuery = `SELECT id, start_time, end_time FROM venue_rentals 
                       WHERE venue_id = ? AND rental_date = ? AND status = 'confirmed' 
                       AND NOT (end_time <= ? OR start_time >= ?)`;
    let rentalParams = [venueId, date, startTime, endTime];

    if (excludeRentalId) {
        rentalQuery += ` AND id != ?`;
        rentalParams.push(excludeRentalId);
    }

    const [rentalConflicts] = await pool.execute(rentalQuery, rentalParams);

    if (rentalConflicts.length > 0) {
        return { type: 'rental', conflict: rentalConflicts[0] };
    }

    return null;
}

// --- Get Available Time Slots for Venue Rental ---
app.get('/api/venue-rentals/available-slots', async (req, res) => {
    try {
        const { venue_id, date } = req.query;
        if (!venue_id || !date) {
            return res.status(400).json({ message: 'Venue ID and date are required.' });
        }

        // Define standard operating hours (e.g., 08:00 to 22:00 in 1-hour blocks)
        const operatingHours = [
            { start: '08:00:00', end: '09:00:00', label: '08:00 AM - 09:00 AM' },
            { start: '09:00:00', end: '10:00:00', label: '09:00 AM - 10:00 AM' },
            { start: '10:00:00', end: '11:00:00', label: '10:00 AM - 11:00 AM' },
            { start: '11:00:00', end: '12:00:00', label: '11:00 AM - 12:00 PM' },
            { start: '12:00:00', end: '13:00:00', label: '12:00 PM - 01:00 PM' },
            { start: '13:00:00', end: '14:00:00', label: '01:00 PM - 02:00 PM' },
            { start: '14:00:00', end: '15:00:00', label: '02:00 PM - 03:00 PM' },
            { start: '15:00:00', end: '16:00:00', label: '03:00 PM - 04:00 PM' },
            { start: '16:00:00', end: '17:00:00', label: '04:00 PM - 05:00 PM' },
            { start: '17:00:00', end: '18:00:00', label: '05:00 PM - 06:00 PM' },
            { start: '18:00:00', end: '19:00:00', label: '06:00 PM - 07:00 PM' },
            { start: '19:00:00', end: '20:00:00', label: '07:00 PM - 08:00 PM' },
            { start: '20:00:00', end: '21:00:00', label: '08:00 PM - 09:00 PM' },
            { start: '21:00:00', end: '22:00:00', label: '09:00 PM - 10:00 PM' }
        ];

        const availableSlots = [];
        for (const slot of operatingHours) {
            const conflict = await checkVenueConflict(venue_id, date, slot.start, slot.end);
            if (!conflict) {
                availableSlots.push({
                    ...slot,
                    price: 1500.00 // Standard hourly rental rate
                });
            }
        }

        res.json(availableSlots);
    } catch (err) {
        console.error('Fetch Available Slots Error:', err);
        res.status(500).json({ message: 'Server error while fetching available slots.' });
    }
});

// --- Initiate Venue Rental Checkout Endpoint ---
app.post('/api/venue-rentals', authenticateToken, async (req, res) => {
    try {
        const { venue_id, rental_date, start_time, end_time, total_price } = req.body;
        const userId = req.user.id;

        if (!venue_id || !rental_date || !start_time || !end_time || !total_price) {
            return res.status(400).json({ message: 'All rental fields are required.' });
        }

        // --- Validate that the rental date & start time is not in the past ---
        const rentalDateTime = new Date(`${rental_date}T${start_time}:00`);
        if (rentalDateTime < new Date()) {
            return res.status(400).json({ message: 'Error: Cannot book a venue for a date and time that has already passed.' });
        }

        // Universal availability check before booking
        const conflict = await checkVenueConflict(venue_id, rental_date, start_time, end_time);
        if (conflict) {
            return res.status(400).json({ 
                message: conflict.type === 'class' 
                    ? `Time conflict: A scheduled class ("${conflict.conflicts?.title || 'Class'}") occupies this time slot.` 
                    : 'Time conflict: This time slot is already booked for a private rental.' 
            });
        }

        // Fetch venue name for PayMongo description
        const [venues] = await pool.execute('SELECT name FROM venue WHERE id = ?', [venue_id]);
        const venueName = venues.length > 0 ? venues.name : 'Dance Studio Venue';

        const amountInCentavos = Math.round(total_price * 100);

        // Create PayMongo Checkout Session
        const paymongoRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        line_items: [{
                            name: `Venue Rental: ${venueName}`,
                            amount: amountInCentavos,
                            currency: 'PHP',
                            quantity: 1
                        }],
                        payment_method_types: ['gcash', 'paymaya', 'card'],
                        success_url: 'http://localhost:3000/PaymentSuccessPage/PaymentSuccessPage.html?type=venue',
                        cancel_url: 'http://localhost:3000/VenueRentalPage/VenueRentalPage.html?cancelled=true',
                        description: `Private Rental for ${venueName} on ${rental_date}`
                    }
                }
            })
        });

        const paymongoData = await paymongoRes.json();
        if (!paymongoRes.ok || !paymongoData.data) {
            return res.status(500).json({ message: paymongoData.errors?.[0]?.detail || 'Failed to initialize checkout session.' });
        }

        const checkoutId = paymongoData.data.id;
        const checkoutUrl = paymongoData.data.attributes.checkout_url;

        // Insert pending rental record
        const [rentalResult] = await pool.execute(
            `INSERT INTO venue_rentals (user_id, venue_id, rental_date, start_time, end_time, total_price, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [userId, venue_id, rental_date, start_time, end_time, total_price]
        );

        // Insert payment record linked to venue_rental_id
        await pool.execute(
            `INSERT INTO payments (venue_rental_id, amount, paymongo_checkout_id, status) VALUES (?, ?, ?, 'pending')`,
            [rentalResult.insertId, total_price, checkoutId]
        );

        res.json({ checkoutUrl });
    } catch (err) {
        console.error('Venue Rental Checkout Error:', err);
        res.status(500).json({ message: 'Server error while initiating venue rental.' });
    }
});

// --- Get Authenticated User Venue Rentals ---
app.get('/api/user/rentals', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rentals] = await pool.execute(
            `SELECT vr.*, v.name AS venue_name 
             FROM venue_rentals vr 
             JOIN venue v ON vr.venue_id = v.id 
             WHERE vr.user_id = ? AND vr.status = 'confirmed'
             ORDER BY vr.rental_date DESC, vr.start_time DESC`,
            [userId]
        );
        res.json(rentals);
    } catch (err) {
        console.error('Fetch User Rentals Error:', err);
        res.status(500).json({ message: 'Server error while fetching rentals.' });
    }
});

// --- Admin: Get All Venue Rentals ---
app.get('/api/admin/venue-rentals', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const [rentals] = await pool.execute(
            `SELECT vr.*, v.name AS venue_name, u.name AS renter_name, u.email AS renter_email, u.phone AS renter_phone 
             FROM venue_rentals vr 
             JOIN venue v ON vr.venue_id = v.id 
             JOIN users u ON vr.user_id = u.id 
             WHERE vr.status = 'confirmed'
             ORDER BY vr.rental_date DESC, vr.start_time DESC`
        );
        res.json(rentals);
    } catch (err) {
        console.error('Admin Fetch Rentals Error:', err);
        res.status(500).json({ message: 'Server error while fetching admin rentals.' });
    }
});

// --- Admin: Update Venue Rental Status (Cancel/Confirm) ---
app.put('/api/admin/venue-rentals/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
        const { status } = req.body;
        const rentalId = req.params.id;

        await pool.execute('UPDATE venue_rentals SET status = ? WHERE id = ?', [status, rentalId]);
        res.json({ message: `Venue rental successfully marked as ${status}.` });
    } catch (err) {
        console.error('Update Rental Status Error:', err);
        res.status(500).json({ message: 'Server error updating rental status.' });
    }
});

app.get('/venues', (req, res) => {
    res.sendFile(path.join(__dirname, 'Pages', 'VenueListPage', 'VenueListPage.html'));
});

// --- Admin: Delete Venue Endpoint ---
app.delete('/api/admin/venues/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }
        const venueId = req.params.id;
        const [venues] = await pool.execute('SELECT image FROM venue WHERE id = ?', [venueId]);
        if (venues.length === 0) {
            return res.status(404).json({ message: 'Venue not found.' });
        }
        const venue = venues[0];

        // 1. Delete main venue cover image file from disk if it exists
        if (venue.image && venue.image.includes('/venueimages/')) {
            const filename = venue.image.split('/venueimages/').pop();
            const filePath = path.join(__dirname, 'public', 'venueimages', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // 2. Fetch and delete all associated gallery image files from disk
        const [galleryImages] = await pool.execute('SELECT image_path FROM venue_images WHERE venue_id = ?', [venueId]);
        for (const img of galleryImages) {
            if (img.image_path && img.image_path.includes('/venueimages/')) {
                const filename = img.image_path.split('/venueimages/').pop();
                const filePath = path.join(__dirname, 'public', 'venueimages', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // 3. Delete venue record (cascade will handle venue_images table rows)
        await pool.execute('DELETE FROM venue WHERE id = ?', [venueId]);
        res.json({ message: 'Venue and all associated images successfully deleted.' });
    } catch (err) {
        console.error('Delete Venue Error:', err);
        res.status(500).json({ message: 'Server error while deleting venue.' });
    }
});

// --- Configure Multer Storage for Venue Images (Folder: venueimages) ---
const venueImgStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'venueimages');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `venue-${uniqueSuffix}${ext}`);
    }
});

const uploadVenueImage = multer({
    storage: venueImgStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

const uploadVenueFilesMiddleware = uploadVenueImage.fields([
    { name: 'venueImage', maxCount: 1 },
    { name: 'galleryFiles', maxCount: 20 }
]);

app.use('/venueimages', express.static(path.join(__dirname, 'public', 'venueimages')));

// --- Admin: Create Venue Endpoint ---
app.post('/api/admin/venues', authenticateToken, uploadVenueFilesMiddleware, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }

        const { name, location, location_link, hourly_rate, galleryMeta } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Venue name is required.' });
        }

        await connection.beginTransaction();

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const mainImagePath = req.files && req.files['venueImage'] ? `/venueimages/${req.files['venueImage'][0].filename}` : null;        
        
        const [venueResult] = await connection.execute(
            'INSERT INTO venue (name, image, location, location_link, hourly_rate) VALUES (?, ?, ?, ?, ?)',
            [name, mainImagePath, location || null, location_link || null, hourly_rate || 1500.00]
        );

        const venueId = venueResult.insertId;

        // Process Gallery Images & Display Order
        const galleryFiles = req.files && req.files['galleryFiles'] ? req.files['galleryFiles'] : [];
        const parsedMeta = galleryMeta ? JSON.parse(galleryMeta) : [];

        let fileIndex = 0;
        for (let i = 0; i < parsedMeta.length; i++) {
            const meta = parsedMeta[i];
            let imagePath = '';

            if (meta.type === 'new') {
                if (galleryFiles[fileIndex]) {
                    imagePath = `${baseUrl}/venueimages/${galleryFiles[fileIndex].filename}`;
                    fileIndex++;
                }
            } else if (meta.type === 'existing') {
                imagePath = meta.url;
            }

            if (imagePath) {
                await connection.execute(
                    'INSERT INTO venue_images (venue_id, image_path, display_order) VALUES (?, ?, ?)',
                    [venueId, imagePath, i]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Venue successfully created!' });
    } catch (err) {
        await connection.rollback();
        console.error('Create Venue Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'A venue with this name already exists.' });
        }
        res.status(500).json({ message: 'Server error while creating venue.' });
    } finally {
        connection.release();
    }
});

// --- Admin: Update Venue Endpoint ---
app.put('/api/admin/venues/:id', authenticateToken, uploadVenueFilesMiddleware, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }

        const venueId = req.params.id;
        const { name, location, location_link, hourly_rate, galleryMeta } = req.body;

        const [existing] = await connection.execute('SELECT id, image FROM venue WHERE id = ?', [venueId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Venue not found.' });
        }

        await connection.beginTransaction();

        const venue = existing[0];
        let mainImagePath = venue.image;
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // Handle Main Venue Image Replacement & Old File Cleanup
        if (req.files && req.files['venueImage']) {
            mainImagePath = `${baseUrl}/venueimages/${req.files['venueImage'][0].filename}`;

            if (venue.image && venue.image.includes('/venueimages/')) {
                const oldFilename = venue.image.split('/venueimages/').pop();
                const oldFilePath = path.join(__dirname, 'public', 'venueimages', oldFilename);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
        }

        await connection.execute(
            'UPDATE venue SET name = ?, image = ?, location = ?, location_link = ?, hourly_rate = ? WHERE id = ?',
            [name, mainImagePath, location || null, location_link || null, hourly_rate || 1500.00, venueId]
        );

        // Fetch old gallery images before clearing mappings to check which ones were removed
        const [oldGalleryImages] = await connection.execute('SELECT image_path FROM venue_images WHERE venue_id = ?', [venueId]);

        // Clear existing gallery mappings in DB
        await connection.execute('DELETE FROM venue_images WHERE venue_id = ?', [venueId]);

        const galleryFiles = req.files && req.files['galleryFiles'] ? req.files['galleryFiles'] : [];
        const parsedMeta = galleryMeta ? JSON.parse(galleryMeta) : [];

        // Collect URLs of existing gallery images that are still kept by the admin
        const keptUrls = new Set(parsedMeta.filter(m => m.type === 'existing').map(m => m.url));

        // Identify and physically delete any old gallery images that were removed from the form
        for (const oldImg of oldGalleryImages) {
            if (!keptUrls.has(oldImg.image_path)) {
                if (oldImg.image_path && oldImg.image_path.includes('/venueimages/')) {
                    const filename = oldImg.image_path.split('/venueimages/').pop();
                    const filePath = path.join(__dirname, 'public', 'venueimages', filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        }

        // Re-insert gallery images according to the new sequence order
        let fileIndex = 0;
        for (let i = 0; i < parsedMeta.length; i++) {
            const meta = parsedMeta[i];
            let imagePath = '';

            if (meta.type === 'new') {
                if (galleryFiles[fileIndex]) {
                    imagePath = `${baseUrl}/venueimages/${galleryFiles[fileIndex].filename}`;
                    fileIndex++;
                }
            } else if (meta.type === 'existing') {
                imagePath = meta.url;
            }

            if (imagePath) {
                await connection.execute(
                    'INSERT INTO venue_images (venue_id, image_path, display_order) VALUES (?, ?, ?)',
                    [venueId, imagePath, i]
                );
            }
        }

        await connection.commit();
        res.json({ message: 'Venue successfully updated!' });
    } catch (err) {
        await connection.rollback();
        console.error('Update Venue Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'A venue with this name already exists.' });
        }
        res.status(500).json({ message: 'Server error while updating venue.' });
    } finally {
        connection.release();
    }
});

// --- Admin: Toggle Venue Active/Inactive Status (Soft Delete) ---
app.put('/api/admin/venues/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
        }
        const venueId = req.params.id;
        const { is_active } = req.body; // Expects 0 (inactive) or 1 (active)

        const [venues] = await pool.execute('SELECT id, name FROM venue WHERE id = ?', [venueId]);
        if (venues.length === 0) {
            return res.status(404).json({ message: 'Venue not found.' });
        }

        await pool.execute('UPDATE venue SET is_active = ? WHERE id = ?', [is_active, venueId]);
        
        const statusText = is_active ? 'activated' : 'deactivated';
        res.json({ message: `Venue successfully ${statusText}. All historical records remain intact.` });
    } catch (err) {
        console.error('Update Venue Status Error:', err);
        res.status(500).json({ message: 'Server error while updating venue status.' });
    }
});

// --- Get Venue Schedule (Classes & Rentals) for Availability Modal ---
app.get('/api/venue-rentals/schedule', async (req, res) => {
    try {
        const { venue_id, date } = req.query;
        if (!venue_id || !date) {
            return res.status(400).json({ message: 'Venue ID and date are required.' });
        }

        // 1. Fetch booked classes using direct date matching
        const [classes] = await pool.execute(
            `SELECT id, title, start_time, end_time FROM classes 
             WHERE venueid = ? AND schedule_date = ?`,
            [venue_id, date]
        );

        // 2. Fetch venue rentals ONLY if their status is 'confirmed'
        const [rentals] = await pool.execute(
            `SELECT id, start_time, end_time FROM venue_rentals 
             WHERE venue_id = ? AND rental_date = ? AND status = 'confirmed'`,
            [venue_id, date]
        );

        res.json({ classes, rentals });
    } catch (err) {
        console.error('Fetch Venue Schedule Error:', err);
        res.status(500).json({ message: 'Server error while fetching venue schedule.' });
    }
});













// --- Server Listener ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🚀 Dance Studio Server running on http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});