require("dotenv").config();

const express = require("express"),
  mongoose = require("mongoose"),
  bcrypt = require("bcryptjs"),
  session = require("express-session"),
  MongoStore = require("connect-mongo"),
  helmet = require("helmet"),
  rateLimit = require("express-rate-limit"),
  path = require("path");
const User = require("./models/User"),
  Note = require("./models/Note");
const app = express(),
  prod = process.env.NODE_ENV === "production",
  port = process.env.PORT || 3000;
for (const k of [
  "MONGODB_URI",
  "SESSION_SECRET",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD_HASH",
])
  if (!process.env[k]) {
    console.error("Missing " + k + " in .env");
    process.exit(1);
  }
if (prod) app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    name: "little_garden_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: prod,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", limiter);
app.use("/api/auth/signup", limiter);
const auth = (req, res, next) =>
  req.session.user
    ? next()
    : res.status(401).json({ error: "Please log in first." });
const admin = (req, res, next) =>
  req.session.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Admin access required." });
const safeUser = (u) => ({
  id: String(u._id),
  username: u.username,
  role: u.role,
});
const safeNote = (n) => ({
  _id: String(n._id),
  authorUsername: n.authorUsername,
  type: n.type,
  text: n.text,
  response: n.response || "",
  createdAt: n.createdAt,
  respondedAt: n.respondedAt || null,
});
async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME.trim(),
    usernameKey = username.toLowerCase();
  let u = await User.findOne({ usernameKey });
  if (!u)
    await User.create({
      username,
      usernameKey,
      passwordHash: process.env.ADMIN_PASSWORD_HASH.trim(),
      role: "admin",
    });
  else {
    u.role = "admin";
    u.passwordHash = process.env.ADMIN_PASSWORD_HASH.trim();
    await u.save();
  }
}
app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const username =
        typeof req.body?.username === "string" ? req.body.username.trim() : "",
      password = req.body?.password;
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username))
      return res.status(400).json({
        error: "Username must be 3–24 characters: letters, numbers, _ or -.",
      });
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    )
      return res
        .status(400)
        .json({ error: "Password must be 8–128 characters." });
    const usernameKey = username.toLowerCase();
    if (usernameKey === process.env.ADMIN_USERNAME.trim().toLowerCase())
      return res.status(400).json({ error: "That username is reserved." });
    if (await User.exists({ usernameKey }))
      return res.status(409).json({ error: "That username already exists." });
    await User.create({
      username,
      usernameKey,
      passwordHash: await bcrypt.hash(password, 12),
      role: "user",
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "That username already exists." });
    next(e);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username =
        typeof req.body?.username === "string" ? req.body.username.trim() : "",
      password =
        typeof req.body?.password === "string" ? req.body.password : "",
      u = await User.findOne({ usernameKey: username.toLowerCase() });
    if (!u || !(await bcrypt.compare(password, u.passwordHash)))
      return res.status(401).json({ error: "Incorrect username or password." });
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.user = safeUser(u);
    res.json(req.session.user);
  } catch (e) {
    next(e);
  }
});
app.get("/api/auth/me", (req, res) =>
  req.session.user
    ? res.json(req.session.user)
    : res.status(401).json({ error: "Not logged in." }),
);
app.post("/api/auth/logout", (req, res, next) =>
  req.session.destroy((e) => {
    if (e) return next(e);
    res.clearCookie("little_garden_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: prod,
    });
    res.json({ ok: true });
  }),
);
app.get("/api/notes/public", auth, async (req, res, next) => {
  try {
    res.json(
      (
        await Note.find({ type: "public" })
          .sort({ createdAt: -1 })
          .limit(300)
          .lean()
      ).map(safeNote),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/notes/private", auth, async (req, res, next) => {
  try {
    res.json(
      (
        await Note.find({ type: "private", authorId: req.session.user.id })
          .sort({ createdAt: -1 })
          .limit(300)
          .lean()
      ).map(safeNote),
    );
  } catch (e) {
    next(e);
  }
});
app.post("/api/notes", auth, async (req, res, next) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "",
      type = req.body?.type;
    if (!text || text.length > 5000)
      return res.status(400).json({ error: "Note must be 1–5000 characters." });
    if (!["public", "private"].includes(type))
      return res.status(400).json({ error: "Choose public or private." });
    const n = await Note.create({
      authorId: req.session.user.id,
      authorUsername: req.session.user.username,
      type,
      text,
    });
    res.status(201).json(safeNote(n));
  } catch (e) {
    next(e);
  }
});
app.get("/api/notes/:id", auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ error: "Note not found." });
    const n = await Note.findById(req.params.id).lean();
    if (!n) return res.status(404).json({ error: "Note not found." });
    if (
      n.type === "private" &&
      String(n.authorId) !== req.session.user.id &&
      req.session.user.role !== "admin"
    )
      return res
        .status(403)
        .json({ error: "You don't have permission to view this note." });
    res.json(safeNote(n));
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/notes", auth, admin, async (req, res, next) => {
  try {
    res.json(
      (await Note.find({}).sort({ createdAt: -1 }).limit(1000).lean()).map(
        safeNote,
      ),
    );
  } catch (e) {
    next(e);
  }
});
app.post("/api/admin/notes/:id/answer", auth, admin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ error: "Note not found." });
    const response =
      typeof req.body?.response === "string" ? req.body.response.trim() : "";
    if (!response || response.length > 5000)
      return res
        .status(400)
        .json({ error: "Answer must be 1–5000 characters." });
    const n = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: { response, respondedAt: new Date() } },
      { new: true, runValidators: true },
    );
    if (!n) return res.status(404).json({ error: "Note not found." });
    res.json(safeNote(n));
  } catch (e) {
    next(e);
  }
});
app.delete("/api/admin/notes/:id", auth, admin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ error: "Note not found." });
    const n = await Note.findByIdAndDelete(req.params.id);
    if (!n) return res.status(404).json({ error: "Note not found." });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.use((e, req, res, next) => {
  console.error(e);
  if (res.headersSent) return next(e);
  res.status(500).json({ error: "Server error. Please try again." });
});
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    await User.init();
    await Note.init();
    await ensureAdmin();
    app.listen(port, () =>
      console.log(`Little Garden running at http://localhost:${port}`),
    );
  })
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  });
