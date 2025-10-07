import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import {  OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
// const GoogleStrategy = require("passport-google-oauth2").Strategy;

//import pool
import pool from "./db.js";
import dotenv from "dotenv";
dotenv.config();


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET =process.env.GOOGLE_CLIENT_SECRET;
const Client = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;




//Check if email exist
const Check_Exist = async (email) => {
  try {
    const results = await pool.query("SELECT * FROM account WHERE email = $1", [
      email,
    ]);
    return results.rows.length !== 0;
  } catch (error) {
    console.error(err.message);
    return false;
  }
};

//Insert email into account
const Insert_query = async (email) => {
  try {
    const Insert = await pool.query(
      "INSERT INTO account (email) VALUES ($1)  RETURNING *",
      [email]
    );
    return Insert;
  } catch (error) {
    console.error(err.message);
    throw err;
  }
};

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: GOOGLE_CLIENT_ID,
//       clientSecret: GOOGLE_CLIENT_SECRET,
//       callbackURL: "http://localhost:3000/google/callback",
//       passReqToCallback: true,
//     },
//     function (request, accessToken, refreshToken, profile, done) {
//       //   User.findOrCreate({ googleId: profile.id }, function (err, user) {
//       //     return done(err, user);
//       //   });
//       return done(null, profile);
//     }
//   )
// );

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: GOOGLE_CLIENT_ID,
//       clientSecret: GOOGLE_CLIENT_SECRET,
//       callbackURL: "http://localhost:3000/google/callback",
//       passReqToCallback: true,
//     },
//     async function (request, accessToken, refreshToken, profile, done) {
//       const email = profile.email[0].value;
//       const isExist = await Check_Exist(email);
//       if(!isExist){
//         try {
//           let user
//           const Insert = await Insert_query(email);
//           user.Insert.rows[0]
//           console.log(`user inserted ${user}`);
//         } catch (error) {
//           console.error("Error Inserting user : ", err.message)
//            return done(error, null);
//         }
//       }else{
//         try{
//           const exist_user = await pool.query("SELECT * FROM account WHERE email = $1", [email]);
//         }catch(err){
//           console.error("Error Selecting User : ",err.message)
//           return done(error, null)
//         }
//       }
//       return done(null, profile);
//     }
//   )
// );

// passport.serializeUser(function (user, done) {
//   done(null, user);
// });

// passport.deserializeUser(function (user, done) {
//   done(null, user);
// });


export const Login_with_Google = async(req, res) => {
  try {
    //Get token from frontend
    const { token } = req.body;
    //Verify token with google 
    const ticket = Client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    //Create payload to send information(payload to decode the JWT)
    const payload = (await ticket).getPayload();
    //get value from payload
    const {sub, name, email, picture } = payload;
    //Check if the user already in DB
    const user = await Check_Exist(email);
    if(!user){
      user = await Insert_query(email);
    }
    //Create JWT
    const user_Token = jwt.sign({
      sub : sub,
      name : name,
      email: email
    }, JWT_SECRET,
  {expiresIn: "7d"});

    //Respond back to frontend
    res.status(200).json({
      Success: true,
      token: user_Token,
      message: "Google token verified successfully",
    });

  } catch (error) {
    console.log("Google Verification Error : ", error);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
}