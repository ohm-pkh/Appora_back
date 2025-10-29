import pool from "./db.js"
import bcrypt from "bcrypt";
import { response } from "express";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from 'sib-api-v3-sdk';



const JWT_SECRET = process.env.JWT_SECRET;

export async function restaurantPageInfo(req, res) {
    try {
        const token = req.query.token;
        const verified = jwt.verify(token, JWT_SECRET);
        const Result = await pool.query('SELECT r.*,a.email FROM restaurants_info r join account a on r.id=a.id WHERE r.id = $1', [verified.id]);
        if (Result.rows.length === 0) {
            return res.status(401).send({
                error: "Invalid information"
            });
        }
        const Data = Result.rows[0];
        res.status(200).json({
            Data,
            role: 'Restaurant'
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Server error" });
    }
}