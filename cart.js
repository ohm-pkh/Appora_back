import pool from "./config/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function getCart(req,res){
    try{
        const token = req.query.token;
        const verified =jwt.verify(token, JWT_SECRET);
        const result = await pool.query(`Select restaurant_id from cart where user_id = $1`,[verified.id]);
        console.log(result.rows);
        res.status(200).json({cartItems:result.rows});
    }catch(e){
        console.log(e);
        res.status(500).send({message:'Server error'});
    }
}

export async function deleteCart(req,res) {
    try{
        const {token,restaurant_id} = req.query;
        const verified =jwt.verify(token, JWT_SECRET);
        await pool.query(`Delete from cart where user_id=$1 and restaurant_id=$2`,[verified.id,restaurant_id]);
        res.status(200).json({message:'Delete Success'});
    }catch(e){
        console.log(e);
        res.status(500).send({message:'Server error'});
    }
}

export async function addCart(req,res) {
    try{
        const {token,restaurant_id} = req.body;
        const verified =jwt.verify(token, JWT_SECRET);
        await pool.query(`Insert Into cart(user_id,restaurant_id) values ($1,$2)`,[verified.id,restaurant_id]);
        res.status(200).json({message:'Add Success'});
    }catch(e){
        console.log(e);
        res.status(500).send({message:'Server error'});
    }
}