import pool from "./db.js"
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"



const app = express();
const PORT = process.env.PORT || 300;
const JWT_SECRET = process.env.JWT_SECRET;
const Appora_pass = process.env.Appora_pass;

//Setup nodemailer for sending email
let transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  secure: true,
  auth: {
    user: "Appora.WGAD@gmail.com",
    pass: Appora_pass
  }
});

//Function to send E-mail
const Send_Email = async(text, email) => {
  let sended = 0;
  try {
    const info = await transporter.sendMail({
      from: `"Appora" <Appora.WGAD@gmail.com>`,
      to: email,
      subject: "Password Recovery",
      text: text,
    });
    sended = 1;
  } catch (error) {
    console.log(error.message);
  }
  return sended;
}

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
      //Get user_Info
      const { email, password, role } = req.body;
      // const {email, password, role, type} = req.body;
      const type = "Verify_res";
      //Hash password
      const hashed_pass = await Hash_Password(password);
      //Create user account in db
      const NewUser = await pool.query(
        "INSERT INTO account (email, password, role , acc_status ) VALUES ($1, $2, $3, 'Complete') RETURNING id",
        [email, hashed_pass, role]
      );

      //Create userInfo for UID
      const user = NewUser.row[0];

      if (role === "restaurant") {
        //Create verification code
        const V_Code = generateRandom6DigitNumber();
        //Hashed the verification code
        const VC_Hashed = await Hash_Password(V_Code);
        const Vid = await pool.query(
          "INSERT INTO validation_code (uid, code, type) VALUES ($1, $2, $3) ON CONFLICT (uid, type) DO UPDATE SET code = EXCLUDED.code RETURNING type;",
          [user.id, VC_Hashed, type]
        );
        //return uid from vcode
        res.status(200).json({
          uid: Vid.rows[0],
          // user: NewUser.rows[0]
          message: "User created with verification code",
        });
      }
      //Return userinfo in json form
      res
        .status(200)
        .json({ user_id: NewUser.rows[0], message: "User Created" });
    }catch(err){
        console.log(err.message);
        res.status(500).send({message: "Internal server error"})
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
          "SELECT id, password, role FROM account WHERE email = $1",
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
    //Get input
    const {Verifycode, email} = req.body;
    const result = await pool.query(
      `SELECT vc.uid, vc.code 
       FROM validation_code vc 
       JOIN account a ON vc.uid = a.id 
       WHERE a.email = $1`,
      [email]
    );
    //If not found 
    if (result.rows.length === 0) {
      res.status(401).send({ error: "Invalid Verified code" });
    }
    //Get vcode
    const Rest_data = result.rows[0];
    //Compare Vcode
    const isMatch = await bcrypt.compare(Verifycode, userData.code);
    //If not matched 
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid verification code" });
    }
    //Update status
    const Verify = await pool.query("UPDATE account  SET acc_status = 'Complete' WHERE id = $1", [res.uid]);
    //Delete Data
    const Del_VC = await pool.query(
      "DELETE FROM validation_code WHERE uid = $1 RETURNING uid",
      [res.uid]
    );
    res.status(200).json({success: true,
      uid: Del_VC.uid,
      message:"Restaurant verified"
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: "Internal server error" });
  }
}

export const Forgot_Pass = async(req, res) => {
  try {
    //Get user email
    const {email} = req.body;
    // const {email, type} = req.body;
    const type = "Recovery";
    //Create Validation code
    const V_Code = generateRandom6DigitNumber();
    //Hashed the verification code
    const VC_Hashed = await Hash_Password(V_Code);
    // Insert into value
    const Vid = await pool.query(
      "INSERT INTO validation_code (uid, code, type) VALUES ($1, $2, $3) ON CONFLICT (uid, type) DO UPDATE SET code = EXCLUDED.code RETURNING type;",
      [user.id, VC_Hashed, type]
    ); 
    //Convert code to string
    const code = V_Code.toString()
    //Text for sending email
    const text = `Your verification code is ${code}`;
    //Create sender and send email
    const Sender =  await Send_Email(text, email);
    if(Sender){
      res.status(200).send({message : "Email Sended"});
    }else{
      res.status(401).send({ message: "Failed to send email" });
    }
  
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: "Internal server error" });
  }
}

export const Reset_Pass = async(req, res) =>{
  try {
    //Get input
    const { password, email } = req.body; 
    // const { password, email, Verifycode } = req.body; 
    
    //If need to verify
    const result = await pool.query(
      `SELECT vc.uid, vc.code 
       FROM validation_code vc 
       JOIN account a ON vc.uid = a.id 
       WHERE a.email = $1`,
      [email]
    );
    //If not found
    if (result.rows.length === 0) {
      res.status(401).send({ error: "Invalid Verified code" });
    }
    //Get vcode
    const Rest_data = result.rows[0];
    //Compare Vcode
    const isMatch = await bcrypt.compare(Verifycode, userData.code);
    //If not matched
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid verification code" });
    }
    //Only reset
    const Repass = await pool.query(
      "UPDATE account SET password = $1 WHERE email = $2 RETURNING *;",
      [password, email]
    );
    res.status(200).json(Repass.rows[0]);
  } catch (error) {
    console.log(error.message);
    res.status(500).send({message: "Internal server error"})
  }
}