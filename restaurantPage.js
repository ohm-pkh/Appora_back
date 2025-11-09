import pool from "./config/db.js"
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
import cloudinary from "./config/cloudinary.js";



const JWT_SECRET = process.env.JWT_SECRET;

function uploadToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({}, (err, result) => {
            if (err) reject(err)
            else resolve({
                url: result.secure_url,
                public_id: result.public_id
            })
        }).end(buffer)
    })
}

function publicIdFromUrl(url) {
    const parts = url.split("/")
    const last = parts[parts.length - 1] // menu_75sf0n.png
    return last.substring(0, last.lastIndexOf(".")) // remove .png
}


export async function restaurantPageInfo(req, res) {
    try {
        const token = req.query.token;
        const verified = jwt.verify(token, JWT_SECRET);
        const Result = await pool.query(`
        SELECT r.name,r.photo_path,r.description,r.lat,r.lon,r.location,r.status,r.emergency,r.public_id,a.email,
        rt.name as type,rt.id as type_id, 
        oc.day, oc.open,oc.close,
        d.id as deli_id,d.name as deli_name,d.link,
        m.id as menu_id,m.name as menu_name,m.description as menu_description,m.photo_path as menu_photo,m.price as menu_price, m.menu_public_id,
        c.id as category_id,c.name as menu_category
        FROM restaurants_info r join account a on r.id=a.id 
        left join restaurant_with_type rwt on rwt.restaurant_id=r.id 
        left join restaurant_types rt on rt.id=rwt.type_id 
        left join open_close_hours oc on r.id=oc.restaurant_id 
        left join delivery d on d.restaurant_id=r.id
        left join menus m on m.restaurant_id=r.id
        left join menu_categories mc on mc.menu_id=m.id
        left join category c on mc.category_id=c.id
        WHERE r.id = $1`, [verified.id]);

        if (Result.rows.length === 0) {
            return res.status(401).send({
                error: "Invalid information"
            });
        }

        const Data = Result.rows[0];
        const userData = {
            name: Data.name,
            photo_path: Data.photo_path,
            description: Data.description,
            lat: Data.lat,
            lon: Data.lon,
            location: Data.location,
            status: Data.status,
            emergency: Data.emergency,
            email: Data.email,
            public_id: Data.public_id
        }

        const type = [];
        const typeFound = {};

        const dayFound = {
            Sun: false,
            Mon: false,
            Tue: false,
            Wed: false,
            Thu: false,
            Fri: false,
            Sat: false
        };
        const days = [];

        const delivery = [];
        const deliFound = {};

        const menu = [];

        Result.rows.forEach(row => {

            // type
            if (row.type_id && !typeFound[row.type_id]) {
                type.push({
                    type: row.type,
                    id: row.type_id
                });
                typeFound[row.type_id] = true;
            }

            // days
            if (row.day && !dayFound[row.day]) {
                days.push({
                    day: row.day,
                    open: timeFormat(row.open),
                    close: timeFormat(row.close)
                });
                dayFound[row.day] = true;
            }

            // delivery
            if (row.deli_id && !deliFound[row.deli_id]) {
                delivery.push({
                    id: row.deli_id,
                    name: row.deli_name,
                    link: row.link
                });
                deliFound[row.deli_id] = true;
            }

            // menu + category  (THIS PART IS FIXED)
            if (row.menu_id) {
                let currentMenu = menu.find(x => x.id === row.menu_id);
                if (!currentMenu) {
                    currentMenu = {
                        id: row.menu_id,
                        name: row.menu_name,
                        description: row.menu_description,
                        photo_path: row.menu_photo,
                        public_id: row.menu_public_id,
                        price: row.menu_price,
                        category: []
                    }
                    menu.push(currentMenu);
                }

                if (row.category_id && !currentMenu.category.some(c => c.id === row.category_id)) {
                    currentMenu.category.push({
                        id: row.category_id,
                        name: row.menu_category
                    });
                }
            }
        });

        res.status(200).json({
            userData,
            types: type,
            days,
            delivery,
            menu,
            role: "Restaurant"
        });

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
        const types = req.query.types; // "uuid1,uuid2,..."
        const typeArray = types ? types.split(',') : [];

        console.log('typeArray:', typeArray);

        const result = await pool.query(
            `SELECT name,id FROM restaurant_types ${typeArray.length > 0 ? 'WHERE id <> ALL($1::uuid[])' : ''}`,
            typeArray.length > 0 ? [typeArray] : []
        );

        res.status(200).json({
            types: result.rows
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: 'Server error'
        });
    }
}


// export async function getType(req, res) {
//     try {
//         const types = req.query.types;
//         console.log('type:', types);
//         const typeQuery = arrToQuery(types);
//         const result = await pool.query(`SELECT name,id FROM restaurant_types ${types ? `WHERE id <> ALL($1::uuid[])` : ''}`,
//             types ? [types] : []
//         );
//         res.status(200).json({
//             types: result.rows
//         });
//     } catch (err) {
//         console.log(err);
//         res.status(500).send({
//             error: "Server error"
//         });
//     }
// }

export async function getMenuCategory(req, res) {
    try {
        const result = await pool.query('SELECT * FROM category');
        const category = result.rows;
        res.status(200).json({
            category
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: "Server error"
        })
    }
}

export async function restaurantUpdate(req, res) {
    try {
        const meta = JSON.parse(req.body.meta)
        console.log(meta);
        const token = meta.token;
        const verified = jwt.verify(token, JWT_SECRET);

        const oldMainPublicId = meta.basicInfo.public_id;

        let newMainPhoto = null;
        const mainFile = req.files.find(f => f.fieldname === "main_photo");

        if (mainFile) {
            newMainPhoto = await uploadToCloudinary(mainFile.buffer)
            if (oldMainPublicId) {
                await cloudinary.uploader.destroy(oldMainPublicId)
            }
        }

        const menuPhotoUpdates = []

        for (let i = 0; i < meta.menus.length; i++) {
            const oldMenuPublicId = meta.menus[i].public_id
            const f = req.files.find(f => f.fieldname === `menu_photo_${i}`)
            if (f) {
                const newUploaded = await uploadToCloudinary(f.buffer)

                if (oldMenuPublicId) {
                    await cloudinary.uploader.destroy(oldMenuPublicId)
                }

                menuPhotoUpdates.push({
                    index: i,
                    url: newUploaded.url,
                    public_id: newUploaded.public_id
                })
            }
        }
        await pool.query(
            `update restaurants_info 
       set name=$1, description=$2, lat=$3, lon=$4, location=$5, status=$6, photo_path=$7, public_id=$8
       where id=$9`,
            [
                meta.basicInfo.name,
                meta.basicInfo.description,
                meta.basicInfo.lat,
                meta.basicInfo.lon,
                meta.basicInfo.location,
                meta.basicInfo.status,
                newMainPhoto?.url || meta.basicInfo.photo_path,
                newMainPhoto?.public_id || meta.basicInfo.public_id,
                verified.id
            ]
        )

        const typeIds = meta.types.map(t => t.id);

        await pool.query(
            `DELETE FROM restaurant_with_type
            WHERE restaurant_id = $1
            AND type_id <> ALL($2::uuid[])`,
            [verified.id, typeIds]
        );


        for (const t of meta.types) {
            await pool.query(
                `INSERT INTO restaurant_with_type(restaurant_id,type_id)
                VALUES($1,$2)
                ON CONFLICT (restaurant_id,type_id) DO NOTHING`,
                [verified.id, t.id]
            )
        }

        // Delete only hours that are no longer in meta.days
        await pool.query(
            `DELETE FROM open_close_hours 
     WHERE restaurant_id = $1 
       AND day NOT IN (${meta.days.map((_, i) => `$${i+2}`).join(",")})`,
            [verified.id, ...meta.days.map(d => d.day)]
        );

        // Upsert remaining/new hours
        for (const d of meta.days) {
            await pool.query(
                `INSERT INTO open_close_hours(restaurant_id,day,open,close)
         VALUES($1,$2,$3,$4)
         ON CONFLICT (restaurant_id,day)
         DO UPDATE SET open=EXCLUDED.open, close=EXCLUDED.close`,
                [verified.id, d.day, d.open, d.close]
            );
        }


        await pool.query(`Delete FROM delivery where restaurant_id = $1`, [verified.id]);

        for (const d of meta.delivery) {
            if (d.name) {
                await pool.query(`INSERT INTO delivery(restaurant_id,name,link) VALUES ($1,$2,$3)`,
                    [verified.id, d.name, d.link]
                )
            }

        };
        const updatedMenuIds = [];

        for (let idx = 0; idx < meta.menus.length; idx++) {
            const m = meta.menus[idx];
            const photo = menuPhotoUpdates.find(p => p.index === idx);

            let result;
            if (typeof m.id === "string") {
                // Update existing menu
                result = await pool.query(`
            UPDATE menus
            SET restaurant_id = $1,
                photo_path = $2,
                price = $3,
                name = $4,
                description = $5,
                menu_public_id = $6
            WHERE id = $7
            RETURNING id
        `, [
                    verified.id,
                    photo?.url ?? m.photo_path,
                    m.price,
                    m.name,
                    m.description,
                    photo?.public_id ?? m.public_id,
                    m.id
                ]);
            } else {
                // Insert new menu
                result = await pool.query(`
            INSERT INTO menus (restaurant_id, photo_path, price, name, description, menu_public_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
                    verified.id,
                    photo?.url ?? null,
                    m.price,
                    m.name,
                    m.description,
                    photo?.public_id ?? null
                ]);
            }

            const menuId = result.rows[0].id;
            updatedMenuIds.push(menuId);

            // Delete old categories for this menu
            await pool.query(`DELETE FROM menu_categories WHERE menu_id = $1`, [menuId]);

            // Insert new categories
            if (m.category && m.category.length > 0) {
                const values = [];
                const placeholders = [];
                m.category.forEach((c, i) => {
                    values.push(menuId, c.id);
                    placeholders.push(`($${i*2 + 1}, $${i*2 + 2})`);
                });
                await pool.query(`
            INSERT INTO menu_categories(menu_id, category_id)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT DO NOTHING
        `, values);
            }
        }

        // Optional: delete menus that were removed (if you want to sync)
        if (updatedMenuIds.length > 0) {
            await pool.query(`
        DELETE FROM menus
        WHERE restaurant_id = $1
        AND id != ALL($2::uuid[])
    `, [verified.id, updatedMenuIds]);
        }




        res.json({
            ok: true,
            mainPhoto: newMainPhoto,
            menuPhotos: menuPhotoUpdates
        })

    } catch (err) {
        console.log(err)
        res.status(500).json({
            error: err.message
        })
    }
}

export async function updateEmergency(req, res) {
    try {

        const newStatus = req.body.emergency;
        const verified = jwt.verify(req.body.token, JWT_SECRET);
        const result = await pool.query(`Update restaurants_info set emergency = $1 where id = $2`, [newStatus, verified.id])
        console.log(verified + 'update emergency to: ' + newStatus);
        res.status(200).json({
            message: 'success'
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: 'Internal error'
        });
    }
}