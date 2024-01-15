const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");

const db =
  process.env.MONGODB_URL;
mongoose
  .connect(db)
  .then(() => {
    console.log(`Connected to DB...`);
  })
  .catch((err) => {
    console.log("Error connecting to DB...", err);
  });
