import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";

interface AIAdviceResponse {
  requiresVisit: boolean;
  visitVerdict: string;
  summary: string;
  mappedDepartment: string;
  mappedEmployeeRole: string;
  mappedDesk: string;
  digitalAlternatives: string[];
  requiredDocuments: Array<{
    name: string;
    description: string;
    isMandatory: boolean;
  }>;
  prerequisites: string[];
  estimatedCounterMinutes: number;
  bestTimeToVisit: string;
}

// Fallback rule-based intelligent knowledge base for instant response & offline resilience
function getKnowledgeBaseAdvice(
  serviceType: string,
  queryText: string,
  language: "en" | "te"
): AIAdviceResponse {
  const isTelugu = language === "te";
  const queryLower = (queryText + " " + serviceType).toLowerCase();

  // 1. Cash transactions
  if (
    queryLower.includes("cash") ||
    queryLower.includes("deposit") ||
    queryLower.includes("withdrawal") ||
    queryLower.includes("నగదు")
  ) {
    const isHighValue =
      queryLower.includes("lakh") ||
      queryLower.includes("crore") ||
      queryLower.includes("50000") ||
      queryLower.includes("heavy") ||
      queryLower.includes("denomination");

    if (isHighValue) {
      return {
        requiresVisit: true,
        visitVerdict: isTelugu
          ? "భౌతిక బ్రాంచ్ సందర్శన అవసరం (హై-వాల్యూ నగదు)"
          : "Physical Branch Visit Required (High-Value Transaction)",
        summary: isTelugu
          ? "₹50,000 లేదా అంతకంటే ఎక్కువ నగదు డిపాజిట్/విత్‌డ్రాయల్ కోసం పాన్ కార్డ్ పరిశీలన మరియు కౌంటర్ క్యాషియర్ ప్రమాణీకరణ అవసరం."
          : "Cash deposits or withdrawals exceeding ₹50,000 require PAN card verification and counter cashier authorization.",
        mappedDepartment: isTelugu ? "నగదు నిర్వహణ విభాగం" : "Cash Operations Department",
        mappedEmployeeRole: isTelugu ? "హెడ్ క్యాషియర్ / క్యాష్ ఆఫీసర్ (కౌంటర్ #1 & #2)" : "Head Cashier / Cash Officer (Counters #1 & #2)",
        mappedDesk: isTelugu ? "నగదు కౌంటర్" : "Cash Teller Counter",
        digitalAlternatives: isTelugu
          ? [
              "₹50,000 లోపు నగదు డిపాజిట్ కోసం 24x7 క్యాష్ డిపాజిట్ మెషిన్ (CDM) ఉపయోగించవచ్చు.",
              "చిన్న మొత్తాల కోసం UPI లేదా IMPS నెట్ బ్యాంకింగ్ బదిలీలను ఉపయోగించండి.",
            ]
          : [
              "Cash Deposit Machine (CDM / CRM) allows instant deposits up to ₹49,999 without counter wait.",
              "Use UPI, IMPS, or NEFT for instant inter-bank digital fund transfers.",
            ],
        requiredDocuments: [
          {
            name: isTelugu ? "అసలు పాన్ కార్డ్ (PAN Card)" : "Original PAN Card",
            description: isTelugu
              ? "₹50,000 కంటే ఎక్కువ లావాదేవీలకు తప్పనిసరి."
              : "Mandatory for cash transactions of ₹50,000 and above under RBI rules.",
            isMandatory: true,
          },
          {
            name: isTelugu ? "బ్యాంక్ పాస్‌బుక్ / చెక్ బుక్" : "Bank Passbook or Cheque Leaf",
            description: isTelugu
              ? "ఖాతా వివరాలు మరియు సంతకం ధృవీకరణ కోసం."
              : "For self-withdrawal debit verification and signature matching.",
            isMandatory: true,
          },
          {
            name: isTelugu ? "ప్రభుత్వ గుర్తింపు కార్డు (Aadhaar/Voter ID)" : "Government Photo ID (Aadhaar / Passport)",
            description: isTelugu ? "కస్టమర్ ధృవీకరణ కోసం." : "Official identity verification at teller counter.",
            isMandatory: true,
          },
        ],
        prerequisites: isTelugu
          ? [
              "కరెన్సీ నోట్లను క్రమబద్ధీకరించి, చిరిగిన నోట్లు లేకుండా చూసుకోండి.",
              "డిపాజిట్/విత్‌డ్రాయల్ స్లిప్‌ను ముందుగానే నింపండి.",
            ]
          : [
              "Sort notes by denomination to expedite teller cash counting.",
              "Ensure passbook signature matches official bank records.",
            ],
        estimatedCounterMinutes: 10,
        bestTimeToVisit: isTelugu ? "ఉదయం 10:30 AM నుండి 12:00 PM వరకు" : "10:30 AM to 12:00 PM (Low wait time)",
      };
    } else {
      return {
        requiresVisit: false,
        visitVerdict: isTelugu
          ? "బ్రాంచ్ సందర్శన అవసరం లేదు - ATM / CDM ద్వారా పూర్తి చేయవచ్చు"
          : "Branch Visit Not Required - Can Be Resolved via ATM / CDM",
        summary: isTelugu
          ? "సాధారణ నగదు విత్‌డ్రాయల్ మరియు ₹50,000 లోపు డిపాజిట్లను సమీపంలోని ATM లేదా క్యాష్ డిపాజిట్ మెషిన్ (CDM) ద్వారా నేరుగా చేయవచ్చు."
          : "Standard withdrawals and cash deposits under ₹50,000 can be executed 24/7 at nearest Bank ATM / Cash Deposit Machine.",
        mappedDepartment: isTelugu ? "డిజిటల్ బ్యాంకింగ్ / ATM నెట్‌వర్క్" : "Digital Banking / ATM Network",
        mappedEmployeeRole: isTelugu ? "సెల్ఫ్-సర్వీస్ ATM / క్యాషియర్ కౌంటర్" : "Self-Service ATM / Alternate Cashier Counter",
        mappedDesk: isTelugu ? "24x7 ATM సెంటర్ / క్యాష్ కౌంటర్" : "24x7 ATM Recycler / Counter #1",
        digitalAlternatives: isTelugu
          ? [
              "డెబిట్ కార్డుతో ఏదైనా ATM నుండి నగదు విత్‌డ్రా చేసుకోండి.",
              "క్యాష్ డిపాజిట్ మెషిన్ (CDM) లో నేరుగా నగదు డిపాజిట్ చేయండి.",
              "తక్షణ చెల్లింపుల కోసం UPI (GPay/PhonePe) ఉపయోగించండి.",
            ]
          : [
              "Use your Debit Card at any 24/7 Bank ATM for cash withdrawals up to your daily limit.",
              "Use Cash Recycler Machine (CDM) for instant cash deposit directly into account.",
              "Use UPI / NetBanking for electronic peer-to-peer transfers.",
            ],
        requiredDocuments: [
          {
            name: isTelugu ? "యాక్టివ్ డెబిట్ కార్డ్ & పిన్" : "Active Debit Card & ATM PIN",
            description: isTelugu ? "ATM / CDM మెషిన్ లావాదేవీలకు అవసరం." : "Required for automated ATM / CDM operations.",
            isMandatory: true,
          },
        ],
        prerequisites: isTelugu
          ? ["మీ రోజువారీ ATM పరిమితి సరిపోతుందని నిర్ధారించుకోండి."]
          : ["Ensure your daily ATM card withdrawal limit is active."],
        estimatedCounterMinutes: 5,
        bestTimeToVisit: isTelugu ? "24x7 ATM సెంటర్లు అందుబాటులో ఉంటాయి" : "Available 24x7 at all ATM kiosks",
      };
    }
  }

  // 2. KYC update
  if (
    queryLower.includes("kyc") ||
    queryLower.includes("aadhaar") ||
    queryLower.includes("pan link") ||
    queryLower.includes("ధృవీకరణ")
  ) {
    return {
      requiresVisit: false,
      visitVerdict: isTelugu
        ? "డిజిటల్ రీ-KYC అందుబాటులో ఉంది (వీడియో KYC / నెట్ బ్యాంకింగ్)"
        : "Digital Self-Service Available (Re-KYC via NetBanking / Video-KYC)",
      summary: isTelugu
        ? "మీ ఆధార్ మరియు పాన్ సమాచారంలో మార్పు లేకపోతే, మీరు మొబైల్ బ్యాంకింగ్ లేదా వీడియో KYC ద్వారా ఆన్‌లైన్‌లోనే Re-KYC పూర్తి చేయవచ్చు. సంతకం లేదా బయోమెట్రిక్ మార్పు ఉంటే మాత్రమే బ్రాంచ్‌కు రండి."
        : "Standard Re-KYC can be completed online via NetBanking or Video-KYC without visiting the branch. Physical visit is only needed if biometric mismatch or signature update is required.",
      mappedDepartment: isTelugu ? "ఖాతా & KYC సమ్మతి విభాగం" : "Accounts & KYC Compliance Desk",
      mappedEmployeeRole: isTelugu ? "KYC వెరిఫికేషన్ ఆఫీసర్ (KYC-01 / KYC-02)" : "KYC Verification Officer (KYC-01 / KYC-02)",
      mappedDesk: isTelugu ? "KYC డెస్క్ #1" : "KYC & Account Desk #1",
      digitalAlternatives: isTelugu
        ? [
            "నెట్ బ్యాంకింగ్ పోర్టల్‌లోకి లాగిన్ అయి 'Service Requests' -> 'Re-KYC Update' ఎంచుకోండి.",
            "OTP ఆధారిత ఆధార్ ధృవీకరణ ద్వారా 2 నిమిషాల్లో అప్‌డేట్ చేయండి.",
          ]
        : [
            "Log in to Bank Internet Banking -> Service Requests -> Online Re-KYC Updation.",
            "Use DigiLocker integration to auto-fetch verified Aadhaar & PAN.",
            "Schedule a 3-minute Video-KYC call with an officer.",
          ],
      requiredDocuments: [
        {
          name: isTelugu ? "అసలు ఆధార్ కార్డ్ (Aadhaar Card)" : "Original Aadhaar Card",
          description: isTelugu ? "చిరునామా మరియు గుర్తింపు ధృవీకరణ కోసం." : "Primary proof of identity and permanent address.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "అసలు పాన్ కార్డ్ (PAN Card)" : "Original PAN Card",
          description: isTelugu ? "ఆదాయపు పన్ను రికార్డుల లింకింగ్ కోసం." : "Mandatory for tax linkage and high-tier accounts.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "2 ఇటీవలి పాస్‌పోర్ట్ సైజ్ ఫోటోలు" : "2 Recent Passport Size Photographs",
          description: isTelugu ? "భౌతిక రికార్డుల కోసం (బ్రాంచ్ సందర్శిస్తే)." : "Required only if physical KYC form is submitted.",
          isMandatory: false,
        },
      ],
      prerequisites: isTelugu
        ? [
            "ఆధార్‌తో లింక్ అయిన మొబైల్ నంబర్ OTP కోసం సిద్ధంగా ఉండాలి.",
            "బ్రాంచ్‌కు వస్తే అసలు పత్రాలను साथ ఉంచుకోండి.",
          ]
        : [
            "Aadhaar-linked mobile phone must be active to receive UIDAI OTP.",
            "Carry original physical documents for instant branch scanner verification.",
          ],
      estimatedCounterMinutes: 12,
      bestTimeToVisit: isTelugu ? "మధ్యాహ్నం 11:00 AM నుండి 1:00 PM వరకు" : "11:00 AM to 1:00 PM",
    };
  }

  // 3. Address change
  if (
    queryLower.includes("address") ||
    queryLower.includes("చిరునామా") ||
    queryLower.includes("change address") ||
    queryLower.includes("shift")
  ) {
    return {
      requiresVisit: false,
      visitVerdict: isTelugu
        ? "ఆన్‌లైన్ ఆధార్ DigiLocker ద్వారా చిరునామా మార్చుకోవచ్చు"
        : "Online Address Update Available via DigiLocker / Aadhaar OTP",
      summary: isTelugu
        ? "మీ కొత్త చిరునామా ఇప్పటికే ఆధార్‌లో అప్‌డేట్ అయి ఉంటే, నెట్ బ్యాంకింగ్ ద్వారా ఆన్‌లైన్‌లోనే మార్చవచ్చు. వేరే పత్రాలు ఉంటే బ్రాంచ్ డెస్క్‌కు రండి."
        : "If your Aadhaar card already reflects your new address, you can update your bank address online in 2 minutes using Aadhaar OTP. Branch visit is only needed for non-Aadhaar proofs (Rent Agreement/Passport).",
      mappedDepartment: isTelugu ? "కస్టమర్ సర్వీస్ & ప్రొఫైల్ విభాగం" : "Customer Service & Profile Maintenance",
      mappedEmployeeRole: isTelugu ? "కస్టమర్ సర్వీస్ ఎగ్జిక్యూటివ్ (CSR-01)" : "Customer Service Representative (CSR-01 / CSR-02)",
      mappedDesk: isTelugu ? "కస్టమర్ సర్వీస్ డెస్క్" : "Customer Service Desk #1",
      digitalAlternatives: isTelugu
        ? [
            "నెట్ బ్యాంకింగ్ -> Profile -> 'Update Communication Address' ఎంచుకోండి.",
            "DigiLocker ద్వారా తాజా ఆధార్ కార్డును జత చేయండి.",
          ]
        : [
            "NetBanking / Mobile App -> Profile Settings -> Update Communication Address.",
            "Authenticate via UIDAI Aadhaar e-Sign OTP.",
          ],
      requiredDocuments: [
        {
          name: isTelugu ? "తాజా చిరునామా రుజువు (ఆధార్ / విద్యుత్ బిల్లు / పాస్‌పోర్ట్)" : "Valid Address Proof (Aadhaar / Utility Bill / Rent Agreement)",
          description: isTelugu ? "గత 3 నెలల్లోపు జారీ చేయబడిన అధికారిక పత్రం." : "Must be less than 3 months old with customer's full name.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "అసలు గుర్తింపు కార్డు (PAN / Aadhaar)" : "Primary Identity Proof (PAN / Aadhaar)",
          description: isTelugu ? "ఖాతాదారుని గుర్తింపు కోసం." : "For verifying existing account holder credentials.",
          isMandatory: true,
        },
      ],
      prerequisites: isTelugu
        ? ["పత్రంపై పేరు బ్యాంక్ రికార్డులతో సరిపోలాలి."]
        : ["Name and father's name on address proof must match bank records precisely."],
      estimatedCounterMinutes: 10,
      bestTimeToVisit: isTelugu ? "ఉదయం 11:30 AM నుండి" : "11:30 AM to 1:00 PM",
    };
  }

  // 4. Card services
  if (
    queryLower.includes("card") ||
    queryLower.includes("debit") ||
    queryLower.includes("credit") ||
    queryLower.includes("pin") ||
    queryLower.includes("block") ||
    queryLower.includes("కార్డ్")
  ) {
    const isLostOrBlock =
      queryLower.includes("lost") ||
      queryLower.includes("block") ||
      queryLower.includes("stolen") ||
      queryLower.includes("దొంగతనం");

    return {
      requiresVisit: false,
      visitVerdict: isTelugu
        ? "100% ఆన్‌లైన్ సేవ - బ్రాంచ్ సందర్శన అవసరం లేదు"
        : "100% Online Self-Service - No Branch Visit Needed",
      summary: isTelugu
        ? isLostOrBlock
          ? "కార్డు పోయినట్లయితే వెంటనే మొబైల్ బ్యాంకింగ్ లేదా SMS ద్వారా బ్లాక్ చేయండి. కొత్త కార్డు మీ ఇంటికే పోస్ట్ ద్వారా వస్తుంది."
          : "డెబిట్/క్రెడిట్ కార్డ్ ఆర్డర్, పిన్ జనరేషన్ మరియు లిమిట్స్ మార్పును మొబైల్ యాప్ ద్వారా తక్షణమే చేసుకోవచ్చు."
        : isLostOrBlock
        ? "Immediately block your card via Mobile App or 24x7 IVR to prevent fraud. A replacement chip card will be dispatched to your registered address."
        : "Green PIN generation, international transaction toggle, limit enhancements, and replacement card requests can be performed instantly via Mobile Banking.",
      mappedDepartment: isTelugu ? "కార్డ్స్ & డిజిటల్ పేమెంట్స్ డెస్క్" : "Cards & Digital Payments Desk",
      mappedEmployeeRole: isTelugu ? "కస్టమర్ సర్వీస్ ఆఫీసర్ (CSR-01)" : "Customer Service Officer (CSR-01 / CSR-02)",
      mappedDesk: isTelugu ? "సర్వీస్ డెస్క్ #1" : "Service Desk #1",
      digitalAlternatives: isTelugu
        ? [
            "మొబైల్ బ్యాంకింగ్ యాప్ -> 'Cards' -> 'Instant Block / Replace' క్లిక్ చేయండి.",
            "ATM మెషిన్ లో 'Green PIN / Set PIN' ద్వారా కొత్త పిన్ సెట్ చేయండి.",
            "24x7 టోల్ ఫ్రీ నంబర్‌కు డయల్ చేసి కార్డును బ్లాక్ చేయండి.",
          ]
        : [
            "Open Mobile Banking App -> Cards -> 'Block & Reissue' or 'Set ATM PIN'.",
            "Generate Green PIN instantly at any Bank ATM using OTP.",
            "Call 24x7 Customer Care IVR for emergency instant hotlisting.",
          ],
      requiredDocuments: [
        {
          name: isTelugu ? "ఖాతా సంఖ్య & మొబైల్ OTP" : "Account Number & Mobile OTP",
          description: isTelugu ? "యాప్ ధృవీకరణ కోసం." : "For 2FA verification in the mobile app.",
          isMandatory: true,
        },
      ],
      prerequisites: isTelugu
        ? ["కమ్యూనికేషన్ చిరునామా సరిగ్గా ఉందని నిర్ధారించుకోండి."]
        : ["Ensure your registered delivery address is current before requesting replacement."],
      estimatedCounterMinutes: 5,
      bestTimeToVisit: isTelugu ? "24x7 మొబైల్ యాప్ అందుబాటులో ఉంది" : "Available 24x7 in Mobile App",
    };
  }

  // 5. Loan enquiry / application
  if (
    queryLower.includes("loan") ||
    queryLower.includes("borrow") ||
    queryLower.includes("home loan") ||
    queryLower.includes("car loan") ||
    queryLower.includes("రుణ")
  ) {
    return {
      requiresVisit: true,
      visitVerdict: isTelugu
        ? "బ్రాంచ్ సందర్శన అవసరం (రుణ పరిశీలన & పత్రాల సమర్పణ)"
        : "Physical Branch Visit Recommended (Document Verification & Appraisal)",
      summary: isTelugu
        ? "ప్రాథమిక అర్హతను ఆన్‌లైన్‌లో తనిఖీ చేయవచ్చు, కానీ ఆస్తి పత్రాలు, శాలరీ స్లిప్‌ల భౌతిక పరిశీలన మరియు రుణ ఒప్పంద సంతకాల కోసం లోన్ ఆఫీసర్‌ను కలవాలి."
        : "Initial eligibility pre-approval is available online, but physical verification of income/property deeds, sanction letter execution, and loan agreement signing requires meeting the Credit Officer.",
      mappedDepartment: isTelugu ? "రుణాలు & క్రెడిట్ అప్రైజల్ విభాగం" : "Loans & Credit Appraisal Department",
      mappedEmployeeRole: isTelugu ? "సీనియర్ లోన్ ఆఫీసర్ (LNO-01 / LNO-02)" : "Senior Loan Officer (LNO-01 / LNO-02)",
      mappedDesk: isTelugu ? "రుణాల డెస్క్ #1" : "Credit & Loan Desk #1",
      digitalAlternatives: isTelugu
        ? [
            "బ్యాంక్ వెబ్‌సైట్‌లో 'Loan Eligibility Calculator' ద్వారా అర్హత తెలుసుకోండి.",
            "ప్రీ-అప్రూవ్డ్ వ్యక్తిగత రుణాల కోసం మొబైల్ యాప్‌లో 1-క్లిక్ డిస్బర్స్‌మెంట్ ప్రయత్నించండి.",
          ]
        : [
            "Check instant pre-approved personal loan offers in Mobile Banking.",
            "Use Bank Online Loan Portal to upload digital salary slips for preliminary in-principle sanction.",
          ],
      requiredDocuments: [
        {
          name: isTelugu ? "గత 3 నెలల శాలరీ స్లిప్‌లు / 2 సంవత్సరాల ITR" : "Last 3 Months Salary Slips / 2 Years ITR Form 16",
          description: isTelugu ? "ఆదాయ ధృవీకరణ మరియు రీపేమెంట్ సామర్థ్యం కోసం." : "Primary proof of stable income and repayment capacity.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "గత 6 నెలల బ్యాంక్ స్టేట్‌మెంట్" : "Last 6 Months Bank Statement (All Accounts)",
          description: isTelugu ? "నగదు ప్రవాహం మరియు క్రెడిట్ హిస్టరీ పరిశీలన కోసం." : "Original bank stamp statement reflecting salary/business cashflows.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "KYC పత్రాలు (PAN, Aadhaar) & 3 ఫోటోలు" : "KYC Documents (PAN Card, Aadhaar Card, 3 Photos)",
          description: isTelugu ? "రుణగ్రహీత గుర్తింపు మరియు నివాస ధృవీకరణ." : "Borrower and co-applicant identity and address proof.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "ఆస్తి పత్రాలు / కొటేషన్ (హోమ్/ఆటో లోన్ కోసం)" : "Property Title Deeds / Vehicle Quotation (For Secured Loans)",
          description: isTelugu ? "ఆస్తి న్యాయ పరిశీలన కోసం." : "Legal scrutiny and collateral valuation documents.",
          isMandatory: false,
        },
      ],
      prerequisites: isTelugu
        ? [
            "మీ క్రెడిట్ స్కోరు (CIBIL) 750+ ఉండేలా చూసుకోండి.",
            "అన్ని ఒరిజినల్ పత్రాలు మరియు 2 సెట్ల జిరాక్స్ కాపీలను తీసుకురండి.",
          ]
        : [
            "Verify that CIBIL score is 750+ for optimal interest rate brackets.",
            "Carry 2 self-attested photocopier sets alongside original documents.",
          ],
      estimatedCounterMinutes: 25,
      bestTimeToVisit: isTelugu ? "మధ్యాహ్నం 11:30 AM నుండి 3:00 PM వరకు" : "11:30 AM to 3:00 PM (Direct Loan Desk)",
    };
  }

  // 6. Cheque services
  if (
    queryLower.includes("cheque") ||
    queryLower.includes("demand draft") ||
    queryLower.includes("dd") ||
    queryLower.includes("చెక్")
  ) {
    return {
      requiresVisit: true,
      visitVerdict: isTelugu
        ? "బ్రాంచ్ సందర్శన అవసరం (భౌతిక చెక్ డ్రాప్‌బాక్స్ / DD జారీ)"
        : "Physical Branch Visit Required (Cheque Drop / DD Issuance)",
      summary: isTelugu
        ? "ఇతర బ్యాంక్ చెక్కుల క్లియరింగ్ లేదా డిమాండ్ డ్రాఫ్ట్ (DD) పొందడానికి బ్రాంచ్ క్లియరింగ్ కౌంటర్‌ను సందర్శించాలి. కొత్త చెక్ బుక్ కోసం ఆన్‌లైన్‌లో ఆర్డర్ చేయవచ్చు."
        : "Physical submission of third-party clearing cheques, cheque stop-payment, and Demand Draft (DD) issuance requires branch counter visit. However, new cheque books can be ordered online.",
      mappedDepartment: isTelugu ? "క్లియరింగ్ & డ్రాఫ్ట్ సర్వీసెస్" : "Clearing & Remittance Department",
      mappedEmployeeRole: isTelugu ? "క్లియరింగ్ క్యాషియర్ (CSH-01 / CSH-02)" : "Clearing Officer / Cashier (CSH-01 / CSH-02)",
      mappedDesk: isTelugu ? "క్లియరింగ్ కౌంటర్" : "Clearing & Cash Counter",
      digitalAlternatives: isTelugu
        ? [
            "కొత్త చెక్ బుక్ రిక్వెస్ట్ కోసం నెట్ బ్యాంకింగ్ ఉపయోగించండి.",
            "డిజిటల్ ఫండ్ బదిలీకి RTGS / NEFT / IMPS ఉపయోగించండి.",
          ]
        : [
            "Order new 25/50 leaf cheque book via Mobile Banking -> Service Requests.",
            "Use NEFT / RTGS / IMPS for instant digital alternative to Demand Drafts.",
          ],
      requiredDocuments: [
        {
          name: isTelugu ? "సరిగ్గా సంతకం చేయబడిన అసలు చెక్" : "Original Signed Physical Cheque Leaf",
          description: isTelugu ? "సరైన తేదీ, మొత్తం మరియు క్రాసింగ్ కలిగి ఉండాలి." : "Must have accurate date, matching amount in words/figures, and counter-signature.",
          isMandatory: true,
        },
        {
          name: isTelugu ? "ఖాతా పాస్‌బుక్ / గుర్తింపు కార్డు" : "Bank Passbook or Customer Photo ID",
          description: isTelugu ? "DD జారీ మరియు క్లియరింగ్ క్రెడిట్ ధృవీకరణ కోసం." : "For cashier authorization of DD debit from your account.",
          isMandatory: true,
        },
      ],
      prerequisites: isTelugu
        ? [
            "చెక్ వెనుక మీ ఖాతా సంఖ్య మరియు ఫోన్ నంబర్ రాయండి.",
            "క్లియరింగ్ కట్-ఆఫ్ సమయం (మధ్యాహ్నం 2:00 PM) లోపు సమర్పించండి.",
          ]
        : [
            "Write account number and contact phone on reverse of cheque leaf.",
            "Submit before CTS clearing cut-off time (2:00 PM) for same-day processing.",
          ],
      estimatedCounterMinutes: 8,
      bestTimeToVisit: isTelugu ? "ఉదయం 10:00 AM నుండి 1:30 PM లోపు (క్లియరింగ్ కటాఫ్)" : "10:00 AM to 1:30 PM (Prior to clearing cut-off)",
    };
  }

  // 7. Account opening / closing
  if (
    queryLower.includes("account") ||
    queryLower.includes("open") ||
    queryLower.includes("close") ||
    queryLower.includes("ఖాతా")
  ) {
    const isClosing = queryLower.includes("close") || queryLower.includes("మూసివేత");
    if (isClosing) {
      return {
        requiresVisit: true,
        visitVerdict: isTelugu
          ? "బ్రాంచ్ సందర్శన తప్పనిసరి (ఖాతా మూసివేత & బకాయిల పరిష్కారం)"
          : "Physical Branch Visit Mandatory (Account Closure & Settlement)",
        summary: isTelugu
          ? "ఖాతా మూసివేతకు మిగిలిన బ్యాలెన్స్ సెటిల్‌మెంట్, చెక్ బుక్/డెబిట్ కార్డ్ సరెండర్ మరియు బ్రాంచ్ మేనేజర్ ఆమోదం అవసరం."
          : "Account closure requires surrender of unutilized cheque leaves, active debit cards, zero-balance settlement, and manager authorization.",
        mappedDepartment: isTelugu ? "బ్రాంచ్ మేనేజ్‌మెంట్ & ఆడిట్ విభాగం" : "Branch Management & Audit Chamber",
        mappedEmployeeRole: isTelugu ? "బ్రాంచ్ మేనేజర్ (MGR-01)" : "Branch Manager / Operations Head (MGR-01)",
        mappedDesk: isTelugu ? "మేనేజర్ ఛాంబర్" : "Manager Chamber #1",
        digitalAlternatives: isTelugu
          ? ["ఖాతా బ్యాలెన్స్‌ను ముందుగానే UPI ద్వారా వేరే ఖాతాకు బదిలీ చేయవచ్చు."]
          : ["Transfer out remaining funds via NetBanking to expedite closing settlement."],
        requiredDocuments: [
          {
            name: isTelugu ? "అసలు పాస్‌బుక్, డెబిట్ కార్డ్ & మిగిలిన చెక్ బుక్" : "Original Passbook, Active Debit Card & Unused Cheque Leaves",
            description: isTelugu ? "రద్దు మరియు డి-యాక్టివేషన్ కోసం సరెండర్ చేయాలి." : "Must be surrendered for physical destruction and safety.",
            isMandatory: true,
          },
          {
            name: isTelugu ? "అసలు గుర్తింపు రుజువు (Aadhaar/PAN)" : "Original Photo ID Proof (Aadhaar / PAN)",
            description: isTelugu ? "ఖాతాదారుని ప్రత్యక్ష ధృవీకరణ కోసం." : "For in-person biometric or signature authentication.",
            isMandatory: true,
          },
        ],
        prerequisites: isTelugu
          ? [
              "ఖాతాకు లింక్ అయిన ఆటో-డెబిట్ (EMI / SIP / ECS) మ్యాండేట్‌లను ముందుగానే రద్దు చేయండి.",
              "లాకర్ లేదా లోన్ బకాయిలు లేవని నిర్ధారించుకోండి.",
            ]
          : [
              "Cancel any linked auto-debit ECS / NACH / SIP mandates beforehand.",
              "Ensure zero outstanding loan or locker rental liabilities.",
            ],
        estimatedCounterMinutes: 15,
        bestTimeToVisit: isTelugu ? "ఉదయం 11:00 AM నుండి 1:00 PM వరకు" : "11:00 AM to 1:00 PM",
      };
    } else {
      return {
        requiresVisit: false,
        visitVerdict: isTelugu
          ? "డిజిటల్ ఖాతా తెరవడం అందుబాటులో ఉంది (Video KYC ద్వారా 5 నిమిషాల్లో)"
          : "Instant Digital Account Opening Available (Via Video KYC)",
        summary: isTelugu
          ? "మీరు బ్రాంచ్‌కు వెళ్లకుండానే మొబైల్ లేదా వెబ్‌సైట్ ద్వారా ఆధార్ OTP & వీడియో KYC తో కొత్త జీరో-బ్యాలెన్స్ లేదా సేవింగ్స్ ఖాతాను తెరవవచ్చు."
          : "You can open an instant Zero-Balance or Premium Savings Account completely online in 5 minutes via Aadhaar e-KYC and a quick 2-minute Video Call.",
        mappedDepartment: isTelugu ? "ఖాతాల ప్రారంభం & ఆన్‌బోర్డింగ్ డెస్క్" : "New Accounts & Onboarding Desk",
        mappedEmployeeRole: isTelugu ? "ఖాతా ప్రారంభ అధికారి (KYC-01 / KYC-02)" : "Account Opening Officer (KYC-01 / KYC-02)",
        mappedDesk: isTelugu ? "ఖాతా డెస్క్ #1" : "Account Desk #1",
        digitalAlternatives: isTelugu
          ? [
              "వెబ్‌సైట్‌లో 'Open Instant Savings Account' క్లిక్ చేయండి.",
              "ఆధార్ నంబర్ మరియు పాన్ ఎంటర్ చేసి వీడియో KYC పూర్తి చేయండి.",
            ]
          : [
              "Click 'Open Digital Account' on the bank portal.",
              "Authenticate via Aadhaar OTP and complete paperless Video-KYC.",
            ],
        requiredDocuments: [
          {
            name: isTelugu ? "అసలు పాన్ కార్డ్ (PAN Card)" : "Original PAN Card",
            description: isTelugu ? "వీడియో KYC సమయంలో కెమెరాలో చూపించాలి." : "Physical plastic card to be shown to the video agent.",
            isMandatory: true,
          },
          {
            name: isTelugu ? "ఆధార్ నంబర్ & లింక్డ్ మొబైల్" : "Aadhaar Card with Mobile Linked",
            description: isTelugu ? "UIDAI e-KYC ధృవీకరణ కోసం." : "For instant UIDAI biometric XML authentication.",
            isMandatory: true,
          },
          {
            name: isTelugu ? "తెల్ల కాగితం & నీలం పెన్" : "Blank White Paper & Blue/Black Pen",
            description: isTelugu ? "వీడియో కాల్ సమయంలో లైవ్ సంతకం కోసం." : "For live signature capture during Video KYC.",
            isMandatory: true,
          },
        ],
        prerequisites: isTelugu
          ? [
              "మంచి ఇంటర్నెట్ కనెక్షన్ మరియు లైటింగ్ ఉండాలి.",
              "భారతదేశంలో భౌతికంగా ఉండాలి.",
            ]
          : [
              "Ensure good camera lighting and high-speed internet connectivity.",
              "GPS location must confirm you are physically within India.",
            ],
        estimatedCounterMinutes: 15,
        bestTimeToVisit: isTelugu ? "ఆన్‌లైన్‌లో 24x7 లేదా బ్రాంచ్‌లో 10:30 AM" : "Online 24x7 or 10:30 AM at branch",
      };
    }
  }

  // Default fallback
  return {
    requiresVisit: true,
    visitVerdict: isTelugu
      ? "సహాయం కోసం బ్రాంచ్ కౌంటర్‌ను సంప్రదించండి"
      : "Branch Counter Consultation Recommended",
    summary: isTelugu
      ? "మీ ప్రశ్నకు ప్రత్యేక పరిష్కారం కోసం సంబంధిత సేవా డెస్క్‌ను సంప్రదించడం మంచిది."
      : "For your specific banking inquiry, our branch customer service desk will provide dedicated assistance.",
    mappedDepartment: isTelugu ? "కస్టమర్ సర్వీస్ విభాగం" : "Customer Service Department",
    mappedEmployeeRole: isTelugu ? "కస్టమర్ రిలేషన్స్ ఆఫీసర్ (CSR-01)" : "Customer Relations Officer (CSR-01)",
    mappedDesk: isTelugu ? "సర్వీస్ డెస్క్ #1" : "Service Desk #1",
    digitalAlternatives: isTelugu
      ? ["మొబైల్ బ్యాంకింగ్ మరియు 24x7 హెల్ప్‌లైన్‌ను ఉపయోగించవచ్చు."]
      : ["Explore the NetBanking Self-Service portal or call 24x7 Phone Banking."],
    requiredDocuments: [
      {
        name: isTelugu ? "అసలు ప్రభుత్వ గుర్తింపు కార్డు (Aadhaar / PAN)" : "Government Photo ID (Aadhaar / PAN Card)",
        description: isTelugu ? "ఖాతాదారుని ధృవీకరణ కోసం." : "Official identity verification at counter.",
        isMandatory: true,
      },
      {
        name: isTelugu ? "బ్యాంక్ పాస్‌బుక్ / ఖాతా వివరాలు" : "Bank Passbook or Account Details",
        description: isTelugu ? "ఖాతా రికార్డుల పరిశీలన కోసం." : "For swift account ledger lookup.",
        isMandatory: true,
      },
    ],
    prerequisites: isTelugu
      ? ["సమస్యకు సంబంధించిన రసీదులు లేదా పత్రాలను తీసుకురండి."]
      : ["Bring any prior correspondence or transaction receipts related to the query."],
    estimatedCounterMinutes: 10,
    bestTimeToVisit: isTelugu ? "ఉదయం 11:00 AM నుండి 2:00 PM వరకు" : "11:00 AM to 2:00 PM",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceType, queryText = "", language = "en" } = body;

    const lang: "en" | "te" = language === "te" ? "te" : "en";
    const apiKey = process.env.GEMINI_API_KEY;

    // If GEMINI_API_KEY is available, invoke Google Gemini 2.5 Flash
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
You are an expert AI Banking Advisor for a premier Core Banking System.
A customer has asked the following query regarding bank branch services:

Service Category: "${serviceType || "General Banking"}"
Customer's Query/Details: "${queryText || "General guidance for this service"}"
Selected Response Language: ${lang === "te" ? "Telugu (తెలుగు)" : "English"}

Your task:
1. Objectively evaluate if the customer REALLY REQUIRES a physical in-person branch visit, or if it can be 100% resolved digitally (via NetBanking, Mobile App, ATM/CDM, DigiLocker, Video-KYC).
2. Map this query to the specific bank department, counter desk, and officer role (e.g. Loan Officer Desk, Cashier Counter, KYC Specialist, Branch Manager).
3. If branch visit is required, specify EVERY mandatory and optional document, certificate, and prerequisite required to resolve the query in one single visit without getting sent back.
4. If branch visit is NOT required, provide the exact step-by-step digital alternative.
5. Output MUST be ONLY valid JSON matching this exact TypeScript structure:

{
  "requiresVisit": boolean,
  "visitVerdict": "Brief punchy verdict headline in ${lang === "te" ? "Telugu" : "English"}",
  "summary": "Clear, direct 2-sentence explanation of why visit is/isn't needed in ${lang === "te" ? "Telugu" : "English"}",
  "mappedDepartment": "Department name in ${lang === "te" ? "Telugu" : "English"}",
  "mappedEmployeeRole": "Specific Officer Role (e.g. Senior Loan Officer / Cashier Counter) in ${lang === "te" ? "Telugu" : "English"}",
  "mappedDesk": "Desk/Counter name in ${lang === "te" ? "Telugu" : "English"}",
  "digitalAlternatives": ["Array of concise bullet points describing online/ATM alternatives in ${lang === "te" ? "Telugu" : "English"}"],
  "requiredDocuments": [
    {
      "name": "Document name (e.g. Original Aadhaar Card)",
      "description": "Why it is needed and specific condition (e.g. Must be within 3 months)",
      "isMandatory": boolean
    }
  ],
  "prerequisites": ["Array of specific actionable preparation points before visiting/applying in ${lang === "te" ? "Telugu" : "English"}"],
  "estimatedCounterMinutes": number,
  "bestTimeToVisit": "Recommended time window with lowest crowd in ${lang === "te" ? "Telugu" : "English"}"
}

Respond ONLY with the raw JSON object. Do not include markdown code block backticks.
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const textResponse = response.text || "";
        const cleanedJson = textResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const parsed = JSON.parse(cleanedJson) as AIAdviceResponse;
        return NextResponse.json({ success: true, data: parsed });
      } catch (geminiError) {
        console.warn("Gemini API call error, falling back to Knowledge Base:", geminiError);
      }
    }

    // High-fidelity domain-expert knowledge-base response
    const advice = getKnowledgeBaseAdvice(serviceType || "", queryText, lang);
    return NextResponse.json({ success: true, data: advice });
  } catch (error: unknown) {
    console.error("AI Advisor error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze query",
      },
      { status: 500 }
    );
  }
}
