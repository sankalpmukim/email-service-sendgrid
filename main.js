const express = require("express");
const bodyParser = require("body-parser");
const sgMail = require("@sendgrid/mail");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const app = express();

// Load environment variables from .env file
dotenv.config();

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION, APP SHUTTING NOW!!");
  console.log(err.message, err.name);
  process.exit(1);
});

// Connect to MongoDB database using Mongoose
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("MongoDB connected successfully"));

// Define schema for email logs
const emailSchema = new mongoose.Schema({
  to: String,
  subject: String,
  message: String,
  recipients: [String],
  type: String,
  createdAt: { type: Date, default: Date.now },
});

const Email = mongoose.model("Email", emailSchema);

// Set up SendGrid API Key and from email address from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const fromEmail = process.env.FROM_EMAIL;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Transactional email endpoint (one to one)
app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    const msg = {
      to,
      from: fromEmail,
      subject,
      text: message,
    };

    await sgMail.send(msg);

    // Log email data to MongoDB database
    const email = new Email({
      to,
      subject,
      message,
      type: "transactional",
    });

    await email.save();

    res.status(200).json({ message: `Email to ${to} sent successfully!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Marketing email endpoint (one to many)
app.post("/send-bulk-email", async (req, res) => {
  try {
    const { subject, message, recipients } = req.body;

    const msg = {
      to: recipients,
      from: fromEmail,
      subject,
      html: message,
    };

    await sgMail.sendMultiple(msg);

    // Log email data to MongoDB database
    const email = new Email({
      recipients,
      subject,
      message,
      type: "marketing",
    });

    await email.save();

    res.status(200).json({ message: "Bulk email sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${process.env.PORT || 3000}`);
});
