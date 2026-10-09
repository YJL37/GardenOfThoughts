const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    authorUsername: { type: String, required: true },
    type: {
      type: String,
      enum: ["public", "private"],
      required: true,
      index: true,
    },
    text: { type: String, required: true, minlength: 1, maxlength: 5000 },
    theme: {
      type: String,
      enum: ["tulip", "sunflower", "lily", "hydrangea"],
      default: "tulip",
      required: true,
    },
    response: { type: String, default: "", maxlength: 5000 },
    createdAt: { type: Date, default: Date.now, required: true, index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: false },
);
schema.index({ type: 1, createdAt: -1 });
schema.index({ type: 1, authorId: 1, createdAt: -1 });
module.exports = mongoose.model("Note", schema);
