import { json } from "@remix-run/node";
import db from "../db.server";
import { cors } from 'remix-utils/cors';


// get request: accept request with request: customerId, shop, productId.
// read database and return wishlist items for that customer.
export async function loader({ request }) {
    const url = new URL(request.url);
    const collectionId = "gid://shopify/Collection/"+url.searchParams.get("collectionId");
    const shop = url.searchParams.get("shop");

 

    if (!collectionId) {
        return json({
            message: "Missing data. Required data: collectionId",
            method: "GET"
        });
    }

    // If customerId, shop, productId is provided, return wishlist items for that customer.
    const board = await db.board.findMany({
        where: {
            collectionId: collectionId,
            shopId: shop


        },
        include: {
            products: true, // Ensure this matches the relation in your schema
        },
    });

    const response = json({
        ok: true,
        message: "Success",
        data: board,
    });

    return cors(request, response);

}


