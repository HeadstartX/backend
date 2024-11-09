const mongoose = require("mongoose");
const { Schema } = mongoose;

const ColdEmailSchema = new Schema({
  to: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isGmail: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    trim: true
  },
  about: {
    type: String,
    trim: true
  },
  experience: [{
    type: String,
    trim: true
  }],
  socials: {
    X: {
      type: String,
      default: "",
      trim: true
    },
    Instagram: {
      type: String,
      default: "",
      trim: true
    },
    LinkedIn: {
      type: String,
      default: "",
      trim: true
    }
  },
  startupName: {
    type: String,
    trim: true
  },
  websiteLink: {
    type: String,
    trim: true
  },
  startupLogo: {
    type: String,
    trim: true
  },
  idea: {
    type: String,
    trim: true
  },
  ideaRoast: {
    type: String,
    trim: true
  },
  businessScores: {
    type: Map,
    of: Number
  },
  businessStrategy: [{
    type: String,
    trim: true
  }],
  competitors: {
    type: String,
    trim: true
  },
  fundingRequirements: [{
    type: String,
    trim: true
  }],
  fundingEmails: [ColdEmailSchema],
  marketingStrategy: [{
    type: String,
    trim: true
  }],
  posts: [{
    type: String,
    trim: true
  }],
  marketingColdEmails: [ColdEmailSchema],
  lastPostDate: {
    type: Date
  },
  basicFundingEmail: {
    type: String, 
    trim: true
  },
  scrapedResearch: {
    type: Array
  }
}, {
  timestamps: true
});

UserSchema.index({ email: 1 });
const User = mongoose.model("User", UserSchema);
module.exports = User;