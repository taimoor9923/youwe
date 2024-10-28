import { authenticate } from "../shopify.server";
import db from "../db.server";
import { cors } from 'remix-utils/cors';
import { json } from '@remix-run/node';

export async function loader({ request }) {
    try {

    const {  payload } = await authenticate.webhook(request);
   // Extract necessary data from the payload
   const { shop_domain, customer, data_request } = payload;

   // Fetch the requested orders
   const orders = await db.order.findMany({
     where: {
       shopId: shop_domain, // Assuming 'shop_domain' corresponds to 'shopId' in your schema
       customerId: customer ? customer.id : ""
      }
    
   });

   // Structure the customer data
   const customerData = {
     customer: {
       id: customer.id,
       email: customer.email,
       phone: customer.phone,
     },
     orders: orders.map(order => ({
       id: order.shopifyId,
       quantity: order.quantity,
       OrderedProducts: order.productId,
      })),
   };

   const responseData = {
     data_request: {
       id: data_request.id,
     },
     customer_data: customerData,
   };

   let response = json({
    ok: true,
    message: "data request success",
    data: responseData,
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