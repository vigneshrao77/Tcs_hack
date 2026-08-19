import mongoose, { Schema, Document, Model } from "mongoose";

export interface IItem extends Document {
  title: string;
  description?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema: Schema<IItem> = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent re-compilation of model if already defined in Next.js hot reload
const Item: Model<IItem> =
  mongoose.models.Item || mongoose.model<IItem>("Item", ItemSchema);

export default Item;
