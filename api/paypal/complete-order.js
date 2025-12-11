import paypal from "@paypal/paypal-server-sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const client = new paypal.core.PayPalHttpClient(
      new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    );

    const { orderID, user_id } = req.body;

    if (!orderID || !user_id) {
      return res.status(400).json({ error: "Missing orderID or user_id" });
    }

    // Capture the payment
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await client.execute(request);

    if (capture.result.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }

    // Extract purchase details
    const purchaseUnit = capture.result.purchase_units[0];
    const customId = purchaseUnit.custom_id;
    const [uid, coinsStr] = customId.split("|");
    const coinsAwarded = parseInt(coinsStr);

    if (uid !== user_id) {
      return res.status(400).json({ success: false, message: "User ID mismatch" });
    }

    // Award coins to user
    const { error: coinError } = await supabase.rpc("add_paid_coins", {
      p_user_id: uid,
      p_amount: coinsAwarded
    });

    if (coinError) {
      console.error("Coin awarding error:", coinError);
      return res.status(500).json({ success: false, message: "Failed to award coins" });
    }

    // Log the transaction
    const usdAmount = parseFloat(purchaseUnit.amount.value);
    await supabase.from("coin_transactions").insert({
      user_id: uid,
      type: "purchase",
      amount: coinsAwarded,
      usd_amount: usdAmount,
      source: "paypal_web",
      external_id: capture.result.id,
      payment_status: "completed",
      metadata: {
        paypal_order_id: orderID,
        paypal_capture_id: capture.result.id
      }
    });

    return res.status(200).json({
      success: true,
      coins_awarded: coinsAwarded,
      order_id: orderID,
      capture_id: capture.result.id
    });
  } catch (error) {
    console.error("PayPal Complete Order Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Payment processing failed"
    });
  }
}