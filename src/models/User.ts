import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  accountNumber: string;
  bankId?: Types.ObjectId;
  bankName: string;
  bankCode: string;
  phone: string;
  phoneVerified: boolean;
  permanentAddress: string;
  password?: string;
  role: "customer" | "admin" | "teller";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    bankId: {
      type: Schema.Types.ObjectId,
      ref: "BankBranch",
      required: false,
    },
    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },
    bankCode: {
      type: String,
      required: [true, "Bank code is required"],
      uppercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    permanentAddress: {
      type: String,
      required: [true, "Permanent address is required"],
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["customer", "admin", "teller"],
      default: "customer",
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
