/**
 * Auth Controller — Login fotografer
 */
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { z }  = require('zod');
const db     = require('../config/db');

const loginSchema = z.object({
  email:    z.string().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);

  const result = await db.query(
    'SELECT id, nama, email, password FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }

  const user = result.rows[0];
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, nama: user.nama },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: { id: user.id, nama: user.nama, email: user.email },
  });
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  const result = await db.query(
    'SELECT id, nama, email, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }
  res.json(result.rows[0]);
}

module.exports = { login, getMe };
