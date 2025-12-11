import paypal from "@paypal/paypal-server-sdk";

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

    const { packageId, price } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: price.toString(),
          },
        },
      ],
    });

    const order = await client.execute(request);

    // Find the approval URL from the order links
    const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      return res.status(500).json({ error: "Failed to get PayPal approval URL" });
    }

    return res.status(200).json({
      id: order.result.id,
      approvalUrl: approvalUrl
    });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    return res.status(500).json({ error: error.message });
  }
}