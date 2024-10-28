import { authenticate } from "../shopify.server";
import db from "../db.server";
 
export const action = async ({ request }) => {
  const { topic, shop, session, admin,payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      break;

      

      case "ORDERS_CREATE":
        console.log("ORDER PAYLOAD: ", payload);
        const { id: orderId, line_items: lineItems, customer } = payload;
  
        for (const item of lineItems) {
          const { id: lineItemId, product_id: productId, quantity, price } = item;
  
          const orderGid = `gid://shopify/Order/${orderId}`;
          const lineItemGid = `gid://shopify/LineItem/${lineItemId}`;
          const productGid = `gid://shopify/Product/${productId}`;
          const customerGid = customer ? `gid://shopify/Customer/${customer.id}` : "";

          const uniqueId = `${orderGid}_${lineItemGid}`;
  
          // Upsert the order record
          await db.order.upsert({
            where: { shopifyId: uniqueId },
            update: {
              productId: productGid,
              quantity: quantity,
              customerId: customerGid, // Add customerId to the order
              shopId: session.shop,
            },
            create: {
              shopifyId: uniqueId,
              productId: productGid,
              customerId: customerGid, // Add customerId to the order
              quantity: quantity,
              shopId: session.shop,
            },
          });
  
          // Find all ProductOnBoard records
          const productsOnBoard = await db.productOnBoard.findMany({
            where: {
              productId: productGid,
            },
          });
  
          for (const productOnBoard of productsOnBoard) {
            // Update the frequency and total price for each record

            const orders = await db.order.findMany({
              where: { productId: productGid, shopId: session.shop }
          });
  
          // Calculate unique customer count
          const uniqueCustomers = new Set(orders.map(order => order.customerId).filter(id => id));

            await db.productOnBoard.update({
              where: { id: productOnBoard.id },
              data: {
                frequency: productOnBoard.frequency + quantity,
                totalPrice: productOnBoard.totalPrice + (quantity * parseFloat(price)),
                uniqueCustomerCount: uniqueCustomers.size,

              },
            });
          }
        }
        throw new Response("Success", { status: 200 });
        break;

        case "PRODUCTS_UPDATE":
        console.log("product PAYLOAD UPDATE: ", payload);
        const { admin_graphql_api_id,title,image } = payload;
        const productsOnBoard = await db.productOnBoard.findMany({
          where: {
            productId: admin_graphql_api_id,
          },
        });

        for (const productOnBoard of productsOnBoard) {
          // Update the title for each record
          await db.productOnBoard.update({
            where: { id: productOnBoard.id },
            data: {
              productTitle: title,
              productImage: image != null ? image.src : "",
             
            },
          });
        }
        
        throw new Response("Success", { status: 200 });
        break;

        case "PRODUCTS_DELETE":
          console.log("product PAYLOAD: ", payload);
          const {id} = payload;
          const productGidUpdate = `gid://shopify/Product/${id}`;

       
           const productsToDelete = await db.productOnBoard.findMany({
            where: {
              productId: productGidUpdate,
            },
          });
  
          for (const productOnBoard of productsToDelete) {
            // Update the title for each record
            await db.productOnBoard.delete({
              where: { id: productOnBoard.id }
          });
          }
          
          throw new Response("Success", { status: 200 });
          break;

         

           

            case "COLLECTIONS_UPDATE":
            console.log("collection PAYLOAD update: ", payload); 
            const collectionToUpdate = payload.admin_graphql_api_id;
            const boardsToUpdate = await db.board.findMany({
              where: {
                collectionId: collectionToUpdate,
                shopId: session.shop,
              },
            });

            for (const board of boardsToUpdate) {
              await db.board.update({
                where: { id: board.id },
                data: {
                  collectionTitle: payload.title
                  
                },
              });
            }
            throw new Response("Success", { status: 200 });

             break;
             case "COLLECTIONS_DELETE":
               console.log("collection PAYLOAD delete: ", payload);
              const collectionGid = `gid://shopify/Collection/${payload.id}`;
              const boardsToDelete = await db.board.findMany({
                where: {
                  collectionId: collectionGid,
                  shopId: session.shop,
                },
              });

              for (const board of boardsToDelete) {
                // Delete associated ProductOnBoard records
                await db.productOnBoard.deleteMany({
                  where: {
                    boardId: board.id,
                  },
                });
        
                // Delete the Board
                await db.board.delete({
                  where: { id: board.id },
                });
              }
              throw new Response("Success", { status: 200 });

             break;
              
          


    case "CUSTOMERS_DATA_REQUEST":
      console.log("CUSTOMERS_DATA_REQUEST payload: ", payload);
      try {
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

        // Respond with the customer data
        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Error handling CUSTOMERS_DATA_REQUEST:", error);
        return new Response("Internal Server Error", { status: 500 });
      }

    case "CUSTOMERS_REDACT":
      console.log("CUSTOMERS_REDACT payload: ", payload);
      try {
        const { shop_id, shop_domain, customer } = payload;

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

       

        return new Response("Success", { status: 200 });
      } catch (error) {
        console.error("Error handling CUSTOMERS_REDACT:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    case "SHOP_REDACT":
      console.log("SHOP_REDACT payload: ", payload);
      try {
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

   

        return new Response("Success", { status: 200 });
      } catch (error) {
        console.error("Error handling SHOP_REDACT:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
       
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
