import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  BankingServiceType,
  CounterCategory,
  SERVICE_CATEGORY_MAP,
} from "@/types/serviceTypes";

export { SERVICE_CATEGORY_MAP };
export type { BankingServiceType, CounterCategory };

export interface IServiceToken extends Document {
  tokenNumber: string;
  userId: Types.ObjectId;
  accountNumber: string;
  customerName: string;
  phone: string;
  bankId?: Types.ObjectId;
  bankCode: string;
  bankName: string;
  serviceType: BankingServiceType;
  assignedCategory: CounterCategory;
  categoryLabel: string;
  assignedEmployeeName: string;
  assignedEmployeeId: string;
  assignedDesk: string;
  status: "waiting" | "called" | "in_service" | "completed" | "cancelled";
  queuePosition: number;
  estimatedWaitMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceTokenSchema: Schema<IServiceToken> = new Schema(
  {
    tokenNumber: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountNumber: {
      type: String,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    bankId: {
      type: Schema.Types.ObjectId,
      ref: "BankBranch",
    },
    bankCode: {
      type: String,
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: [
        "Cash withdrawal or deposit",
        "Account opening and closing",
        "Loan enquiry",
        "Loan application",
        "KYC update",
        "Cheque services",
        "Address change",
        "Card services",
      ],
    },
    assignedCategory: {
      type: String,
      required: true,
      enum: [
        "cashCounters",
        "loanOfficers",
        "customerService",
        "accountAndKyc",
        "managers",
      ],
    },
    categoryLabel: {
      type: String,
      required: true,
    },
    assignedEmployeeName: {
      type: String,
      default: "Branch Officer #1",
    },
    assignedEmployeeId: {
      type: String,
      default: "EMP-01",
    },
    assignedDesk: {
      type: String,
      default: "Counter #1",
    },
    status: {
      type: String,
      enum: ["waiting", "called", "in_service", "completed", "cancelled"],
      default: "waiting",
      index: true,
    },
    queuePosition: {
      type: Number,
      default: 1,
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 5,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Scalability Compound Indexes for High-Concurrency Lookups
ServiceTokenSchema.index({ bankCode: 1, assignedCategory: 1, createdAt: -1 });
ServiceTokenSchema.index({ bankCode: 1, status: 1 });
ServiceTokenSchema.index({ accountNumber: 1, status: 1, createdAt: -1 });
ServiceTokenSchema.index({ createdAt: -1 });

const ServiceToken: Model<IServiceToken> =
  mongoose.models.ServiceToken ||
  mongoose.model<IServiceToken>("ServiceToken", ServiceTokenSchema);

export default ServiceToken;
