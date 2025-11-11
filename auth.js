import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import pool from "./config/db.js"; // your PostgreSQL pool
import dotenv from "dotenv";
dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Check if email exists
const checkExist = async (email) => {
  const result = await pool.query("SELECT * FROM account WHERE email=$1", [email]);
  return result.rows.length > 0;
};

// Insert new user
const insertUser = async (email) => {
  const result = await pool.query("INSERT INTO account(email) VALUES($1) RETURNING *", [email]);
  return result.rows[0];
};

// Select user info
const selectUser = async (email) => {
  const result = await pool.query("SELECT id, role, acc_status FROM account WHERE email=$1" , [email]);
  return result.rows[0];
};

// Login with Google
export const Login_with_Google = async (req, res) => {
  try {
    const { token } = req.body;
    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email } = payload;
    const Loweremail = email.toLowerCase();

    // Check if user exists
    let user = await selectUser(Loweremail);
    if (!user) {
      return res.status(404).send({
        email,
        message: 'Account not found',
      })
    }else if(user.acc_status === "Pending"){
      return res.status(403).send({
        email,
        message: "Account not complete",
      })
    }

    // Create JWT
    const userToken = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      token: userToken,
      role: user.role,
    });

  } catch (err) {
    console.error("Google Verification Error:", err);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
};
