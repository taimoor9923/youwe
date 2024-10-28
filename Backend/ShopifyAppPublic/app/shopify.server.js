import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  BillingInterval
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04";
import prisma from "./db.server";
export const MONTHLY_PLAN = 'Monthly subscription';

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  billing: {
    [MONTHLY_PLAN]: {
      amount: 14.99,
      currencyCode: 'USD',
      interval: BillingInterval.Every30Days,
      trialDays: 7, // Adding 7 days free trial
    }
  },
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_DELETE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    }, 
    COLLECTIONS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    COLLECTIONS_DELETE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    }
 

  },
  hooks: {
    afterAuth: async ({ session, admin, shop }) => {
      shopify.registerWebhooks({ session });
      // Sync existing products and orders
      try {

        console.log("Webhooks registered successfully.");
 

        const fetchOrdersQuery = `
  query fetchOrders($cursor: String) {
    orders(first: 250, after: $cursor) {
      edges {
        node {
          id
          customer {
          id
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                product {
                  id
                }
                quantity
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

        // Fetch and save all orders
        let orders = [];
        let hasNextPage = true;
        let cursor = null;
        const MAX_COST = 100; // Adjust this according to your rate limit (100 for Standard plan)

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        while (hasNextPage) {
          const response = await admin.graphql(fetchOrdersQuery, {
            variables: {
              cursor: cursor,
            },
          });

          const orderData = await response.json();
          
          const { edges, pageInfo } = orderData.data.orders;
          orders = orders.concat(edges.map(edge => edge.node));
          cursor = pageInfo.endCursor;
          hasNextPage = pageInfo.hasNextPage;

          // Parse headers for cost and available points
          const cost = response.headers.get('X-GraphQL-Cost-Incurred');
          const availablePoints = response.headers.get('X-GraphQL-Available-Points');

          // Calculate remaining points and decide if delay is needed
          if (availablePoints < MAX_COST) {
            const delay = (MAX_COST - availablePoints) / MAX_COST * 1000;
            await sleep(delay);
          }
        }
       
        for (const order of orders) {
           for (const item of order.lineItems.edges) {
             if (order && item && item.node && item.node.product && item.node.product.id && item.node.quantity) {


              const uniqueId = `${order.id.toString()}_${item.node.id.toString()}`;
              await prisma.order.upsert({
                where: { shopifyId: uniqueId },
                update: {
                  productId: item.node.product.id.toString(),
                  quantity: item.node.quantity,
                  customerId: order.customer != null ? order.customer.id.toString() : "",
                  shopId: session.shop
                },
                create: {
                  shopifyId: uniqueId,
                  productId: item.node.product.id.toString(),
                  quantity: item.node.quantity,
                  customerId: order.customer != null ? order.customer.id.toString() : "",
                  shopId: session.shop

                },
              });
            }
          }
        }

        console.log("Products and orders synced successfully.");
      } catch (error) {
        console.error("Error in afterAuth hook:", error);
      }


    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
