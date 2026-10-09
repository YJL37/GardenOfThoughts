const mongoose = require("mongoose");
module.exports = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      username: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 24,
      },
      usernameKey: { type: String, required: true, unique: true, index: true },
      passwordHash: { type: String, required: true },
      role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
        required: true,
      },
    },
    { timestamps: true },
  ),
);
