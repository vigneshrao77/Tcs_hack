import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOtpToken extends Document {
  phone: string;
  otpHash: string;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const OtpTokenSchema: Schema<IOtpToken> = new Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "5m" }, // Automatically deletes expired OTP documents after 5 minutes
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const OtpToken: Model<IOtpToken> =
  mongoose.models.OtpToken ||
  mongoose.model<IOtpToken>("OtpToken", OtpTokenSchema);

export default OtpToken;
