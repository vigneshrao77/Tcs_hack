import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], language = "en", bankCode } = body;

    const lastMessage = messages.length > 0 ? messages[messages.length - 1].text : "";
    const isTelugu = language === "te";

    if (!lastMessage || !lastMessage.trim()) {
      return NextResponse.json(
        { success: false, error: "Message content cannot be empty" },
        { status: 400 }
      );
    }

    // Attempt Gemini 1.5 Flash conversational response
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        let branchContext = "Standard Bank Branch";
        try {
          await connectToDatabase();
          if (bankCode) {
            const branch = await BankBranch.findOne({ bankCode }).lean();
            if (branch) {
              branchContext = `Branch: ${branch.bankName} (${branch.bankCode}), Location: ${branch.bankLocation}`;
            }
          }
        } catch {
          // DB non-blocking
        }

        const systemPrompt = `You are a polite, knowledgeable, and empathetic AI Banking Assistant at an Indian Core Banking branch (${branchContext}).
Operating hours of the branch are strictly 09:00 AM to 05:00 PM, Monday to Saturday.

Key Banking Counter Services:
1. Cash Counter: Deposits, withdrawals, DD issuance. (Cash deposits >₹50,000 require PAN card).
2. Account & KYC Desk: New savings/current account opening, fixed deposits, Aadhaar/PAN linking, biometric re-verification, address update.
3. Loan & Credit Desk: Personal, home, vehicle, gold, agriculture, and business loans. Interest inquiries and loan applications.
4. Customer Service Desk: Debit/Credit cards, ATM PIN generation, lost card blocking, cheque books, profile updates.
5. Manager Chamber: Escalations, high-value locker operations, special sanctions.

Instructions:
- Language: Respond in ${isTelugu ? "fluent, natural Telugu (తెలుగు)" : "clear, warm, professional English"}.
- Answer customer queries directly with step-by-step guidance.
- Explicitly state whether the customer needs to visit the branch physically or if they can do it online (Mobile Banking / NetBanking / ATM).
- If branch visit is required, specify the exact documents (e.g. Original Aadhaar, PAN card, Passport size photo, Salary slips/ITR).
- Mention that tokens can be booked directly on this portal for time slots between 09:00 AM and 05:00 PM.
- Keep the response concise, nicely formatted with bullet points, and easy to read on mobile.`;

        // Format history
        const formattedContents: any[] = [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: isTelugu ? "నమస్కారం! నేను మీ బ్యాంకింగ్ అసిస్టెంట్‌ని. మీకు ఎలా సహాయపడగలను?" : "Hello! I am your AI Banking Assistant. How can I help you today?" }] },
        ];

        messages.forEach((m: ChatMessage) => {
          formattedContents.push({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          });
        });

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: formattedContents,
        });

        const replyText = response.text || (isTelugu ? "క్షమించండి, మీ ప్రశ్నకు సమాధానం ఇవ్వలేకపోయాను. దయచేసి మళ్ళీ ప్రయత్నించండి." : "I am sorry, I could not process your request. Please try again.");

        return NextResponse.json({
          success: true,
          reply: replyText,
        });
      } catch (geminiErr) {
        console.warn("Gemini chat error, falling back to rule-based assistant:", geminiErr);
      }
    }

    // Fallback rule-based banking response
    let fallbackReply = "";
    const lower = lastMessage.toLowerCase();

    if (lower.includes("loan") || lower.includes("రుణం") || lower.includes("లోన్")) {
      fallbackReply = isTelugu
        ? `🏦 **రుణాల సమాచారం (Loans):**\n\n• **అందుబాటులో ఉన్న రుణాలు:** హోమ్ లోన్, కార్ లోన్, పర్సనల్ లోన్, గోల్డ్ లోన్, బిజినెస్ లోన్.\n• **అవసరమైన పత్రాలు:** ఆధార్ కార్డ్, పాన్ కార్డ్, గత 6 నెలల బ్యాంక్ స్టేట్‌మెంట్, 3 నెలల శాలరీ స్లిప్‌లు లేదా 2 సంవత్సరాల ITR.\n• **బ్రాంచ్ సందర్శన:** లోన్ దరఖాస్తు మరియు సంతకాల కోసం బ్రాంచ్‌లోని **లోన్ డెస్క్ (Loan Desk)** వద్దకు వెళ్ళాలి.\n• **పని వేళలు:** ఉదయం 9:00 నుండి సాయంత్రం 5:00 వరకు.`
        : `🏦 **Loan Advisory & Applications:**\n\n• **Available Loans:** Home Loan, Auto Loan, Personal Loan, Gold Loan, Business Loan.\n• **Required Documents:** Original Aadhaar Card, PAN Card, Last 6 months bank statement, 3 months salary slips or 2 years ITR.\n• **Branch Visit:** Physical visit to the **Loan & Credit Desk** is required for document verification and agreement signing.\n• **Bank Hours:** 09:00 AM to 05:00 PM.`;
    } else if (lower.includes("kyc") || lower.includes("aadhaar") || lower.includes("pan") || lower.includes("ఆధార్") || lower.includes("పాన్")) {
      fallbackReply = isTelugu
        ? `📋 **KYC అప్‌డేట్ వివరాలు:**\n\n• **అవసరమైన పత్రాలు:** ఒరిజినల్ ఆధార్ కార్డ్, పాన్ కార్డ్, 2 పాస్‌పోర్ట్ సైజ్ ఫోటోలు.\n• **బ్రాంచ్ విజిట్:** బయోమెట్రిక్ వేలిముద్ర ధృవీకరణ కోసం **ఖాతా & KYC డెస్క్ (Account & KYC Desk)** వద్దకు రావడం తప్పనిసరి.\n• **బుకింగ్:** మీరు ఈ పోర్టల్‌లో ఉదయం 9:00 నుండి సాయంత్రం 5:00 వరకు సమయం బుక్ చేసుకోవచ్చు.`
        : `📋 **KYC Re-verification & Compliance:**\n\n• **Required Documents:** Original Aadhaar Card, PAN Card, 2 Passport-sized photographs.\n• **Branch Visit:** Physical visit to the **Account & KYC Desk** is required for biometric authentication.\n• **Operating Window:** Slots available between 09:00 AM and 05:00 PM.`;
    } else if (lower.includes("card") || lower.includes("pin") || lower.includes("atm") || lower.includes("కార్డు")) {
      fallbackReply = isTelugu
        ? `💳 **డెబిట్ / క్రెడిట్ కార్డు సేవలు:**\n\n• **కార్డు బ్లాక్ చేయడం:** బ్యాంక్ మొబైల్ యాప్ లేదా నెట్ బ్యాంకింగ్‌లో తక్షణమే బ్లాక్ చేయవచ్చు (బ్రాంచ్‌కు రానవసరం లేదు).\n• **కొత్త కార్డు / పిన్:** బ్రాంచ్‌లోని **కస్టమర్ సర్వీస్ డెస్క్ (Customer Service Desk)** వద్ద కొత్త కార్డు పొందవచ్చు.\n• **పని వేళలు:** 9:00 AM – 5:00 PM.`
        : `💳 **Debit & Credit Card Services:**\n\n• **Block Lost Card:** Can be done instantly via Mobile Banking / Internet Banking without visiting branch.\n• **New Card / Green PIN:** Visit the **Customer Service Desk** at your branch.\n• **Bank Hours:** 09:00 AM to 05:00 PM.`;
    } else {
      fallbackReply = isTelugu
        ? `నమస్కారం! మా బ్రాంచ్ ఉదయం **9:00 AM నుండి సాయంత్రం 5:00 PM** వరకు పనిచేస్తుంది.\n\nమీరు నగదు డిపాజిట్, ఖాతా తెరవడం, లోన్ దరఖాస్తు, KYC అప్‌డేట్ లేదా కార్డు సేవల కోసం ఈ పోర్టల్‌లో టోకెన్ మరియు సమయాన్ని బుక్ చేసుకోవచ్చు. మీకు ఏ సమాచారం కావాలో ఇక్కడ అడగండి!`
        : `Hello! Our bank branch is open from **09:00 AM to 05:00 PM**.\n\nYou can book tokens for Cash Deposits, Account Opening, Loan Enquiries, KYC Updates, and Card Services on this portal. How can I help you today?`;
    }

    return NextResponse.json({
      success: true,
      reply: fallbackReply,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to handle chat message",
      },
      { status: 500 }
    );
  }
}
