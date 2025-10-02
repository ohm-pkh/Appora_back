import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors());//waiting for frontend

app.use(express.json());


app.get("/", (req, res) => {
  res.send("Hello World!");
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});