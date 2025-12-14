import paypal from "@paypal/paypal-server-sdk";

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

    const { amount, coins, user_id } = req.body;
    console.log('Create Order Request:', { amount, coins, user_id });

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toString(),
          },
          custom_id: `${user_id}|${coins}`,
        },
      ],
    });

    const order = await client.execute(request);
    const orderId = order.result.id;
    console.log('Created PayPal Order ID:', orderId);

    // Return ONLY { id: order.id } exactly
    return res.status(200).json({
      id: orderId
    });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    return res.status(500).json({ error: error.message });
  }
}