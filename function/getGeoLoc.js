import axios from "axios";

const GEO_KEY = process.env.GEOKEY;

export async function getLoc(lat, lon) {
    try {
        const response = await axios.get("https://us1.locationiq.com/v1/reverse.php", {
            params: {
                key: GEO_KEY,
                lat: lat,
                lon: lon,
                format: "json",
            },
        });
        return response.data.display_name; 
    } catch (error) {
        console.error("Failed to fetch location:", error);
    }
}