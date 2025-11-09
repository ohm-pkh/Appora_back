import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import { Profiler } from "react";
import session  from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {Login_with_Google} from "./auth.js"
import {
  Register,
  Login,
  Verify,
  //Forgot_Pass,
  Reset_Pass,
  Resend_code,
  Check_email,
  CheckAuth,
} from "./login.js";
import pool from "./config/db.js";
import { restaurantPageInfo,getType,getLocationInfo,getMenuCategory,restaurantUpdate,updateEmergency} from "./restaurantPage.js";
import upload from "./config/multer.js";
import getRestaurants from "./restaurants.js";
import { restaurantFullDetain } from "./restaurants.js";
import { getCart,deleteCart,addCart } from "./Cart.js";
import getTransportTime from "./getTransportTime.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT;

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100, 
  message: "Too many requests from this IP, please try again after 15 minutes",
});

const cartLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5,
  message: "Too many cart actions, please wait a moment",
});


app.use(cors());
app.use(express.json());
app.use(limiter);
// app.use(session({secret: `cat`}));
// app.use(passport.initialize());
// app.use(passport.session());
// app.use(helmet());

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}


// app.get("/", (req, res) => {
//   res.send(`<a href="/auth/google"'>Login with google</a>`);
// });

// app.get("/auth/google", 
//   passport.authenticate('google', {scope: ['email', 'profile']})
// );

// app.get("/google/callback", 
//   passport.authenticate('google', {
//     successRedirect: '/protected',
//     failureRedirect: '/auth/failure',
//   })
// );

// app.get("/auth/failure", (req,res) => {
//   res.send("You're not logged in")
//   res.status(401).send("Authentication Failed");
// });

// app.get("/protected", isLoggedIn, (req,res) => {
//   res.send(`Hello ${req.user.displayName}`)
// });

// app.get("/logout", (req,res) => {
//   req.logout(function(err){
//     if(err){
//       return next(err);
//     }
//     req.session.destroy(function(err){
//       if(err){
//         return next(err);
//       }
//     })
//     res.send("Bye");
//   });
// });


app.get("/", (req,res) =>{
  console.log("Server is alive!");
  res.send('Server is alive! Welcome to Appora!');
})

app.get("/testdb", async (req,res) =>{
  try{
    await pool.query(`SELECT 1 FROM account;`);
    console.log("DB Working.");
    res.status(200).json({
      success: true,
    })
  }catch(err){
    console.log(err);
    res.status(404).send({
      success: false,
    }
    );
  }
})

//Authentication
app.post("/Sign_in", Register);
app.post("/LogIn", Login);
app.get("/LogIn",CheckAuth);
app.get("/RestaurantPage",restaurantPageInfo);
app.patch("/RestaurantPage", upload.any(), restaurantUpdate)
app.post("/Gauth",Login_with_Google)
app.post("/Verify", Verify);
app.get("/Verify",Resend_code);
//app.post("/ForPass", Forgot_Pass);
app.get("/ForPass",Check_email)
app.post("/Reset_pass", Reset_Pass);
app.get("/Type", getType);
app.get("/Location",getLocationInfo);
app.get("/Menu",getMenuCategory);
app.patch("/Emergency",updateEmergency);
app.get('/Restaurants',getRestaurants);
app.get('/RestaurantDetail',restaurantFullDetain);
app.get('/Cart',getCart);
app.delete('/Cart',cartLimiter,deleteCart)
app.post('/Cart',cartLimiter,addCart)
app.post('/TransportTime',getTransportTime)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});