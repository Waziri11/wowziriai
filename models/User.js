import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    codeHash: String,
    expiresAt: Date,
    resendAvailableAt: Date,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    interests: { type: [String], default: [] },
    emailVerified: { type: Boolean, default: false },
  emailVerifyIssuedAt: { type: Date },
    otp: { type: otpSchema, default: {} },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
