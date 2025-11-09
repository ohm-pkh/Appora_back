import pool from "./config/db.js"
import timeFormat from "./function/timeFormat.js";

export default async function getRestaurants(req, res) {
    const now = new Date();
    const search = req.query.search;
    console.log(req.query.search);
    const days = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"];
    const day = days[now.getDay()];
    const formattedTime = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    console.log('day', day, 'time', formattedTime);
    try {
        const result = await pool.query(`
            SELECT distinct r.*,max(m.price) as max_price,min(m.price) as min_price ,(jsonb_agg(distinct jsonb_build_object('id', t.id, 'name', t.name) )) as types, jsonb_agg(distinct jsonb_build_object('id', c.id, 'name', c.name) ) as categories
            from restaurants_info r 
            left join open_close_hours oc on r.id = oc.restaurant_id 
            left join menus m on m.restaurant_id = r. id 
            left join restaurant_with_type rt on rt.restaurant_id = r.id
            left join restaurant_types t on t.id=rt.type_id
            left join menu_categories mc on m.id=mc.menu_id
            left join category c on c.id= mc.category_id
            WHERE oc.open <= $1 
            AND oc.close >= $1 
            AND oc.day = $2 
            AND r.emergency <> true 
            AND r.status = 'Available'
            ${search ? `$3 = '' AND (
                r.name % $3 OR 
                m.name % $3 OR 
                t.name % $3 OR 
                c.name % $3
            )` : ``}
            ${ search ? `ORDER BYGREATEST(
                similarity(r.name, $3),
                similarity(m.name, $3),
                similarity(t.name, $3),
                similarity(c.name, $3)
            ) DESC
            ` : ``}
            group by r.id
        `, search ? [formattedTime, day, search] : [formattedTime, day]);
        console.log(result.rows);
        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(404).send({
            message: 'not found'
        });
    }
}

export async function restaurantFullDetain(req, res) {
    try {
        const id = req.query.id;
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
        WHERE r.id = $1`, [id]);

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
        });

    } catch (err) {
        console.log(err);
        res.status(500).send({
            error: "Server error"
        });
    }

}