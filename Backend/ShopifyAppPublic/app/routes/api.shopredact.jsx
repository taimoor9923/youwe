import { authenticate } from "../shopify.server";
import db from "../db.server";
import { cors } from 'remix-utils/cors';
import { json } from '@remix-run/node';

export async function loader({ request }) {
  try {

  const {  payload } = await authenticate.webhook(request);
  const {   shop_domain } = payload;

  // Delete all data associated with the shop

  // 1. Delete sessions
  await db.session.deleteMany({
    where: { shop: shop_domain }, // Assuming 'shop_domain' corresponds to 'shop' in your Session model
  });

  // 2. Delete boards and associated ProductOnBoard records
  const boards = await db.board.findMany({
    where: { shopId: shop_domain },
  });

  for (const board of boards) {
    // Delete associated ProductOnBoard records
    await db.productOnBoard.deleteMany({
      where: { boardId: board.id },
    });

    // Delete the Board itself
    await db.board.delete({
      where: { id: board.id },
    });
  }

  // 3. Delete orders
  await db.order.deleteMany({
    where: { shopId: shop_domain },
  });



  let response = json({
    ok: true,
    message: "shop data erase success"
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