import pool from "./db.js"
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"



const app = express();
const PORT = process.env.PORT || 300;
const JWT_SECRET = process.env.JWT_SECRET;

//Create random 6 digit validation code
function generateRandom6DigitNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

//Hash password
const Hash_Password = (pass) => {
  return bcrypt.hash(pass, 10);
}
//Compare Hash password
const Compare_Hash = (pass, H_pass) =>{
  return bcrypt.compare(pass, H_pass);
}


//Create Account
export const Register = async(req, res) => {
    try{
        const V_Code = generateRandom6DigitNumber();
        //Get user_Info
        const { email, password, role } = req.body;
        
        //Hash password
        const hashed_pass = await Hash_Password(password);
        //Create user account in db
        const NewUser = await pool.query(
          "INSERT INTO account (email, password, role , acc_status ) VALUES ($1, $2, $3) RETURNING *",
          [email, hashed_pass, role]
        );
        //Return userinfo in json form
        res.json(NewUser.row[0]);
        
        //Create userInfo for UID
        const user = NewUser.row[0]
        
        if(role == "restaurant"){
          const Vid = await pool.query(
            "INSERT INTO validation_code (uid, code), VALUES ($1 ,$2) RETURNING *",
            [user.id ,V_Code]
          );
        }
        res.status(200)
    }catch(err){
        console.log(err.message);
        throw(err);
    }
}


//Login
export const Login = async(req, res) => {
    try {
        //Get info from frontend
        const { email, password } = req.body;

        //Get userInfo
        const UserResult = await pool.query(
          "SELECT * FROM account WHERE email = $1",
          [email]
        );

        //If no user with specific email
        if (UserResult.rows.count === 0) {
          res.status(401).send({ error: "Invalid information" });
        }

        //Create data from info
        const user = UserResult.rows[0];

        //Compare hashed password with inputted password 
        const isMatch = await Compare_Hash(password, user.password);
        if (!isMatch) {
          return res.status(401).send({ error: "Invalid email or password" });
        }
        
        //Create JWT
        const token = jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        {expiresIn: "7d"}
      );

        //Send Response
        res.status(200).json({
          // user: {
          //   id: user.id,
          //   email: user.email,
          //   role: user.role,
          // },
          token: token
        });
    } catch (err) {
        console.log(err.message);
        res.status(500).send({error: "Internal server error"});
    }
}

export const Verify_res = async(req, res) => {
  try {
    const {Verifycode} = req.body;
    const User = await pool.query(
      "SELECT * FROM validation_code WHERE code = $1",
      [Verifycode]
    ); 
    if(User.rows.length === 0){
      res.status(401).send({error: "Invalid Verified code"})
    }
    const res = User.rows[0];
    const Verify = await pool.query("UPDATE account  SET acc_status = 'verified' WHERE id = $1", [res.uid]);
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: "Internal server error" });
  }
}

export const Forgot_Pass = async(req, res) => {
  try {
    const {email} = req.body;
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: "Internal server error" });
  }
}