import paypal from "@paypal/paypal-server-sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Disable caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Use ONLY PAYPAL_ENV to select environment - no auto-detection
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const isSandbox = process.env.PAYPAL_ENV === 'sandbox';

    console.log('PayPal Environment:', isSandbox ? 'SANDBOX' : 'LIVE', `(PAYPAL_ENV: ${process.env.PAYPAL_ENV})`);

    const client = new paypal.core.PayPalHttpClient(
      isSandbox
        ? new paypal.core.SandboxEnvironment(clientId, process.env.PAYPAL_CLIENT_SECRET)
        : new paypal.core.LiveEnvironment(clientId, process.env.PAYPAL_CLIENT_SECRET)
    );

    const { orderID, user_id } = req.body;
    console.log('📥 Capture Order Request received - OrderID:', orderID, 'UserID:', user_id);

    if (!orderID || !user_id) {
      return res.status(400).json({ error: "Missing orderID or user_id" });
    }

    if (!orderID.trim()) {
      return res.status(400).json({ error: "Invalid orderID - empty or whitespace" });
    }

    // Validate orderID format (PayPal order IDs are typically 17-19 characters)
    if (orderID.length < 10 || orderID.length > 25) {
      return res.status(400).json({ error: "Invalid orderID format" });
    }

    // Capture the payment - EXACT orderID from frontend
    console.log('Attempting to capture PayPal order:', orderID);
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    let capture;
    try {
      capture = await client.execute(request);
    } catch (error) {
      console.error('PayPal capture error:', error);

      // Fail hard on 404 or INVALID_RESOURCE_ID
      if (error.statusCode === 404 || error.message?.includes('INVALID_RESOURCE_ID')) {
        console.error('FATAL: PayPal order not found or invalid:', orderID);
        return res.status(400).json({
          success: false,
          message: "PayPal order not found or invalid. Payment cannot be processed."
        });
      }

      // Re-throw other errors
      throw error;
    }

    if (capture.result.status !== "COMPLETED") {
      console.error('PayPal capture incomplete:', capture.result.status);
      return res.status(400).json({
        success: false,
        message: `Payment status: ${capture.result.status}. Payment not completed.`
      });
    }

    console.log('PayPal capture successful for order:', orderID);

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