import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT;

app.use(cors());//waiting for frontend

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

/*
app.get("/test", async(req, res)=>{
    try {
        const result = await pool.query("SELECT * FROM account;");
        res.json({ time: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
})
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});