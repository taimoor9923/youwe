import { authenticate } from "../shopify.server";
import db from "../db.server";
import { cors } from 'remix-utils/cors';
import { json } from '@remix-run/node';

export async function loader({ request }) {
    try {

    const {  payload } = await authenticate.webhook(request);
  const {   shop_domain, customer } = payload;

  if (!customer || !customer.id) {
    return new Response("Bad Request: Missing customer information", { status: 400 });
  }

  // Construct the customer GID
  const customerGid = `gid://shopify/Customer/${customer.id}`;

  // Delete specified orders
  await db.order.deleteMany({
    where: {
      shopId: shop_domain, // Assuming 'shop_domain' corresponds to 'shopId' in your schema
       customerId: customerGid
    },
  });

let response = json({
    ok: true,
    message: "Success",
   });

   return cors(request, response);
} catch (error) {
    // If authentication fails or there's an error, return 401 Unauthorized
    return json({
        ok: false,
        message: "Unauthorized",
    }, { status: 401 });
}

};