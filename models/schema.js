const mongoose = require("mongoose");

const sttSchema = new mongoose.Schema({
  normalText: {
    type: String,
    required: [true, "Spoken text is required"],
  },
  confidenceScore: {
    type: Number,
    required: [true, "Confidence score is required"],
  },
});

const latestSTT = new mongoose.model("latestSTT", sttSchema);
module.exports = latestSTT;
