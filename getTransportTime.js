import pool from "./config/db.js";
import axios from "axios";

const ORS_API_KEY = process.env.ORS_API_KEY;
const PROFILE = "foot-walking";


async function getORSDuration(start, end) {
  try {
    console.log('start',start,'end',end)
    const response = await axios.get(`https://api.openrouteservice.org/v2/directions/${PROFILE}?api_key=${ORS_API_KEY}&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`);
    return response.data.features[0].properties.summary.duration;
  } catch (err) {
    if (err.code === "ECONNRESET") {
      console.warn("Connection reset, retrying...");
      return await getORSDuration(start, end); // retry once
    }
    throw err;
  }
}

// async function getORSDuration(start, end) {
//     const url = `https://api.openrouteservice.org/v2/directions/${PROFILE}?api_key=${ORS_API_KEY}&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`;
//     const response = await axios.get(url);
//     console.log(response.data.features[0].properties.summary);
//     return 1
//     //return response.data.routes[0].summary.duration; // in seconds
// }

export default async function getTransportTime(req, res) {
    try {
        const {
            currentLocation,
            cart
        } = req.body;
        console.log('current',currentLocation,"cart",cart)
        if (!currentLocation || !cart) {
            return res.status(400).json({
                error: "Missing currentLocation or cart"
            });
        }

        // Filter items missing transport_time
        const itemsToUpdate = cart.filter(item => item.transport_time === undefined);

        if (itemsToUpdate.length === 0) {
            return res.json({
                cart
            }); // nothing to update
        }

        // Fetch lat/lon from DB for missing items
        const updatedItems = await Promise.all(itemsToUpdate.map(async (item) => {
            console.log('item',item);
            const query = "SELECT lat, lon FROM restaurants_info WHERE id = $1";
            const {
                rows
            } = await pool.query(query, [item.id]);
            if (!rows[0]) throw new Error(`Destination not found for id ${item.id}`);

            const dest = {
                lat: rows[0].lat,
                lon: rows[0].lon
            };
            const duration = await getORSDuration(currentLocation, dest);

            return {
                id: item.id,
                transport_time: duration
            };
        }));

        // Merge updatedItems back into original cart
        const finalCart = cart.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated ? updated : item;
        });

        return res.json({
            cart: finalCart
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err.message
        });
    }
}