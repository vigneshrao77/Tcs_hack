import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStaffing {
  managers: number;
  cashCounters: number;
  loanOfficers: number;
  customerService: number;
  accountAndKyc: number;
}

export interface ICoordinates {
  latitude: number;
  longitude: number;
}

export interface IBankBranch extends Document {
  bankName: string;
  bankLocation: string;
  bankPhone: string;
  bankCode: string;
  coordinates?: ICoordinates;
  staffing: IStaffing;
  totalStaff: number;
  status: "active" | "maintenance" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

const StaffingSchema: Schema<IStaffing> = new Schema(
  {
    managers: {
      type: Number,
      default: 1,
      min: [1, "At least 1 Manager is required"],
    },
    cashCounters: {
      type: Number,
      default: 2,
      min: [0, "Cash counters cannot be negative"],
    },
    loanOfficers: {
      type: Number,
      default: 1,
      min: [0, "Loan officers cannot be negative"],
    },
    customerService: {
      type: Number,
      default: 2,
      min: [0, "Customer service staff cannot be negative"],
    },
    accountAndKyc: {
      type: Number,
      default: 2,
      min: [0, "Account & KYC staff cannot be negative"],
    },
  },
  { _id: false }
);

const CoordinatesSchema: Schema<ICoordinates> = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

const BankBranchSchema: Schema<IBankBranch> = new Schema(
  {
    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
      maxlength: [120, "Bank name cannot exceed 120 characters"],
    },
    bankLocation: {
      type: String,
      required: [true, "Bank location is required"],
      trim: true,
      maxlength: [300, "Location cannot exceed 300 characters"],
    },
    bankPhone: {
      type: String,
      required: [true, "Bank phone number is required"],
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters"],
    },
    bankCode: {
      type: String,
      required: [true, "Bank code / branch code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [20, "Bank code cannot exceed 20 characters"],
    },
    coordinates: {
      type: CoordinatesSchema,
      required: false,
    },
    staffing: {
      type: StaffingSchema,
      default: () => ({
        managers: 1,
        cashCounters: 2,
        loanOfficers: 1,
        customerService: 2,
        accountAndKyc: 2,
      }),
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "closed"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for calculating total employees
BankBranchSchema.virtual("totalStaff").get(function (this: IBankBranch) {
  if (!this.staffing) return 0;
  return (
    (this.staffing.managers || 0) +
    (this.staffing.cashCounters || 0) +
    (this.staffing.loanOfficers || 0) +
    (this.staffing.customerService || 0) +
    (this.staffing.accountAndKyc || 0)
  );
});

// Scalability Indexes
BankBranchSchema.index({ bankCode: 1 }, { unique: true });
BankBranchSchema.index({ bankName: 1, bankLocation: 1 });
BankBranchSchema.index({ status: 1, createdAt: -1 });

const BankBranch: Model<IBankBranch> =
  mongoose.models.BankBranch ||
  mongoose.model<IBankBranch>("BankBranch", BankBranchSchema);

export default BankBranch;
