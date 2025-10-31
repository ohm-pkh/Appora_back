import pool from "./db.js"
import bcrypt from "bcrypt";
import {
    response
} from "express";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from 'sib-api-v3-sdk';
import arrToQuery from "./function/arrToQuery.js";



const JWT_SECRET = process.env.JWT_SECRET;

export async function restaurantPageInfo(req, res) {
    try {
        const token = req.query.token;
        const verified = jwt.verify(token, JWT_SECRET);
        const Result = await pool.query('SELECT r.name,r.photo_path,r.description,r.lat,r.lon,r.status,a.email,rt.name as type,rt.id as type_id FROM restaurants_info r join account a on r.id=a.id left join restaurant_with_type rwt on rwt.restaurant_id=r.id left join restaurant_types rt on rt.id=rwt.type_id WHERE r.id = $1', [verified.id]);
        if (Result.rows.length === 0) {
            return res.status(401).send({
                error: "Invalid information"
            });
        }
        const Data = Result.rows[0];
        const type = [];
        if (Data.type_id) {
            Result.rows.forEach((row) => {
                type.push({
                    type: row.type,
                    id: row.type_id
                });
            });
        }
        res.status(200).json({
            Data,
            types: type,
            role: 'Restaurant'
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: "Server error"
        });
    }
}

export async function getType(req,res){
    try{
        const types = req.query.types;
        const typeQuery = arrToQuery(types);
        const result = await pool.query('SELECT name,id FROM restaurant_types WHERE id <> ALL($1::uuid[])',[typeQuery]);
        res.status(200).json({
            types: result.rows
        });
    }catch(err){
        console.log(err);
        res.status(500).send({error: "Server error"});
    }
}