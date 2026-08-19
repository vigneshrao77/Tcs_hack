export type BankingServiceType =
  | "Cash withdrawal or deposit"
  | "Account opening and closing"
  | "Loan enquiry"
  | "Loan application"
  | "KYC update"
  | "Cheque services"
  | "Address change"
  | "Card services";

export type CounterCategory =
  | "cashCounters"
  | "loanOfficers"
  | "customerService"
  | "accountAndKyc"
  | "managers";

export interface ServiceMeta {
  category: CounterCategory;
  label: string;
  prefix: string;
  avgMinutes: number;
  iconId: string;
  description: string;
  digitalEligible: boolean;
  digitalAlternative?: string;
}

export const SERVICE_CATEGORY_MAP: Record<BankingServiceType, ServiceMeta> = {
  "Cash withdrawal or deposit": {
    category: "cashCounters",
    label: "Cash Counter",
    prefix: "CSH",
    avgMinutes: 5,
    iconId: "cash",
    description: "Deposit or withdraw cash, currency exchange, and cash deposits.",
    digitalEligible: true,
    digitalAlternative: "Use Cash Deposit Machines (CDM) or 24x7 ATMs for instant withdrawal.",
  },
  "Account opening and closing": {
    category: "accountAndKyc",
    label: "Account & KYC Desk",
    prefix: "ACC",
    avgMinutes: 15,
    iconId: "account",
    description: "Open savings/current accounts, fixed deposits, or account closure requests.",
    digitalEligible: true,
    digitalAlternative: "Open digital savings accounts instantly via Mobile App with Video KYC.",
  },
  "Loan enquiry": {
    category: "loanOfficers",
    label: "Loan & Credit Desk",
    prefix: "LNE",
    avgMinutes: 12,
    iconId: "loan",
    description: "Discuss interest rates, eligibility criteria for home, auto, or personal loans.",
    digitalEligible: true,
    digitalAlternative: "Check pre-approved loan offers and calculate EMI on NetBanking portal.",
  },
  "Loan application": {
    category: "loanOfficers",
    label: "Loan & Credit Desk",
    prefix: "LNA",
    avgMinutes: 25,
    iconId: "loan",
    description: "Submit documentation, loan verification, sanctioning & disbursement.",
    digitalEligible: false,
  },
  "KYC update": {
    category: "accountAndKyc",
    label: "Account & KYC Desk",
    prefix: "KYC",
    avgMinutes: 10,
    iconId: "kyc",
    description: "Update Aadhaar/PAN, periodic re-KYC, and biometric records.",
    digitalEligible: true,
    digitalAlternative: "Complete Re-KYC online through Internet Banking if details are unchanged.",
  },
  "Cheque services": {
    category: "cashCounters",
    label: "Cash & Clearing Counter",
    prefix: "CHQ",
    avgMinutes: 6,
    iconId: "cheque",
    description: "Cheque clearance, banker's cheques, demand drafts, and stop payment requests.",
    digitalEligible: true,
    digitalAlternative: "Drop local cheques directly in the 24/7 branch Cheque Drop Box.",
  },
  "Address change": {
    category: "customerService",
    label: "Customer Service Desk",
    prefix: "ADR",
    avgMinutes: 8,
    iconId: "address",
    description: "Update registered communication address, email, or nominee details.",
    digitalEligible: true,
    digitalAlternative: "Update address instantly using DigiLocker integration on mobile banking.",
  },
  "Card services": {
    category: "customerService",
    label: "Customer Service Desk",
    prefix: "CRD",
    avgMinutes: 7,
    iconId: "card",
    description: "Debit/Credit card blocking, PIN regeneration, international usage & replacement.",
    digitalEligible: true,
    digitalAlternative: "Manage card limits, generate Green PIN, and block cards via Mobile Banking.",
  },
};
