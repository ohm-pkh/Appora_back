import pool from "./db.js"
import bcrypt from "bcrypt";
import {
    response
} from "express";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from 'sib-api-v3-sdk';
import arrToQuery from "./function/arrToQuery.js";
import axios from "axios";
import {
    getLoc
} from "./function/getGeoLoc.js";
import timeFormat from "./function/timeFormat.js";



const JWT_SECRET = process.env.JWT_SECRET;

export async function restaurantPageInfo(req, res) {
    try {
        const token = req.query.token;
        const verified = jwt.verify(token, JWT_SECRET);
        const Result = await pool.query('SELECT r.name,r.photo_path,r.description,r.lat,r.lon,r.status,a.email,rt.name as type,rt.id as type_id, oc.day, oc.open,oc.close,r.emergency FROM restaurants_info r join account a on r.id=a.id left join restaurant_with_type rwt on rwt.restaurant_id=r.id left join restaurant_types rt on rt.id=rwt.type_id left join open_close_hours oc on r.id=oc.restaurant_id WHERE r.id = $1', [verified.id]);
        if (Result.rows.length === 0) {
            return res.status(401).send({
                error: "Invalid information"
            });
        }
        const Data = Result.rows[0];
        const type = [];
        const day = {
            Sun: false,
            Mon: false,
            Tue: false,
            Wed: false,
            Thu: false,
            Fri: false,
            Sat: false
        }
        const days = [];
        const typeFound = {};
        if (Data.type_id) {
            Result.rows.forEach((row) => {
                if (!typeFound[row.type]) {
                    type.push({
                        type: row.type,
                        id: row.type_id
                    });
                    typeFound[row.type] = true;
                }

                if (!day[row.day]) {
                    days.push({
                        day: row.day,
                        open: timeFormat(row.open),
                        close: timeFormat(row.close)
                    })
                    day[row.day] = true
                }

            });
        }
        res.status(200).json({
            Data,
            types: type,
            days,
            role: 'Restaurant'
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: "Server error"
        });
    }
}

export async function getLocationInfo(req, res) {
    try {
        const {
            lat,
            lon
        } = req.query
        const location = await getLoc(lat, lon);
        console.log(location);
        res.status(200).json({
            location
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: 'Internal server error'
        })
    }
}

export async function getType(req, res) {
    try {
        const types = req.query.types;
        const typeQuery = arrToQuery(types);
        const result = await pool.query('SELECT name,id FROM restaurant_types WHERE id <> ALL($1::uuid[])', [typeQuery]);
        res.status(200).json({
            types: result.rows
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: "Server error"
        });
    }
}