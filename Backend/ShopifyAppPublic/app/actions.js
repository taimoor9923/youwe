import prisma from "./db.server";
import { json } from "@remix-run/node";
 
 
export const fetchProducts = async (admin, formData, shop) => {
    const collectionId = formData.get("collectionId");

    let products = [];
    let hasNextPage = true;
    let cursor = null;
    let collectionImgTemp = "";

    while (hasNextPage) {
        const productsResponse = await admin.graphql(
            `#graphql
      query getProductsByCollection($collectionId: ID!, $cursor: String) {
        collection(id: $collectionId) {
          image {
                  url
                }
         
          products(first: 250, after: $cursor) {
            edges {
              node {
                id
                title
                handle
                featuredImage {
                    url
                }
                variants(first: 1) { 
                  edges {
                    node {
                      price
                    }
                  }
                
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
            {
                variables: {
                    collectionId: collectionId,
                    cursor: cursor,
                },
            }
        );

        const productsJson = await productsResponse.json();
         const newProducts = productsJson.data.collection && productsJson.data.collection.products ? productsJson.data.collection.products.edges.map(edge => edge.node) : [];
         products = products.concat(newProducts);

                hasNextPage = productsJson.data.collection && productsJson.data.collection.products ? productsJson.data.collection.products.pageInfo.hasNextPage : false;

        if (!hasNextPage && productsJson.data.collection && productsJson.data.collection.image != null) {

            collectionImgTemp = productsJson.data.collection.image.url || "";

        }

        cursor = productsJson.data.collection && productsJson.data.collection.products ? productsJson.data.collection.products.pageInfo.endCursor : null;
    }
     // Loop over all products and return them
    const productDetails = products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        productImg: product.featuredImage && product.featuredImage.url || "",
        price: product.variants.edges[0].node.price
    }));

    return json({
        products: productDetails,
        collectionImg: collectionImgTemp,
        collectionCount: productDetails.length

    });

}


export const saveBoard = async (admin, formData, shop) => {
 
    const orders = await prisma.order.findMany({ where: { shopId: shop } });
    const boardId = formData.get('boardId');

    const boardTitle = formData.get('boardTitle');
    const rowsToDisplay = formData.get('rowsToDisplay');
    const collectionTitle = formData.get('collectionTitle');
    const sortRowsBy = formData.get('sortRowsBy');
    const titleTextColor = formData.get('titleTextColor');
    const backgroundColor = formData.get('backgroundColor');
    const collectionIdDB = formData.get('collectionId');
    const columns = JSON.stringify(formData.get('columns')); // Save columns as string
    const collectionProducts = JSON.parse(formData.get('collectionProducts'));
    const collectionImg = formData.get('collectionImg');
    const collectionCount = Number(formData.get('collectionCount'));
    const collectionStatus = JSON.parse(formData.get('collectionStatus'));



    const productFrequency = {};
    orders.forEach(order => {
        if (!productFrequency[order.productId]) {
            productFrequency[order.productId] = { count: 0, totalPrice: 0, uniqueCustomers: new Set()  };
        }
        productFrequency[order.productId].count += order.quantity;
        productFrequency[order.productId].uniqueCustomers.add(order.customerId);

    });

    const boardProducts = [];
    for (const product of collectionProducts) {
        const productData = productFrequency[product.id] || { count: 0, totalPrice: 0, uniqueCustomers: new Set() };


        const productPrice = parseFloat(product.price);
        if (productData.count === 0) {
            productData.totalPrice = productPrice;
        } else {
            productData.totalPrice = productData.count * productPrice;
        }
        boardProducts.push({
            productId: product.id,
            productTitle: product.title,
            productHandle:product.handle,

            productImage: product.productImg,
            frequency: productData.count,
            uniqueCustomerCount: productData.uniqueCustomers.size,
            totalPrice: productData.totalPrice,
            shopId: shop
        });

    }


    if (boardId) {
        // Update existing board
        const updatedBoard = await prisma.board.update({
            where: { id: boardId, shopId: shop },
            data: {
                title: boardTitle,
                collectionTitle,
                rowsToDisplay: parseInt(rowsToDisplay),
                sortRowsBy,
                collectionImg,
                collectionCount,
                collectionStatus,
                titleTextColor,
                backgroundColor,
                columnConfiguration: columns,
                status: true,
                collectionId: collectionIdDB,
                products: {
                    deleteMany: {}, // Delete existing products
                    create: boardProducts // Add new products
                },
                shopId: shop
            }
        });

        return json({ success: true, board: updatedBoard, updated: true });
    } else {
        // Create new board
        const newBoard = await prisma.board.create({
            data: {
                title: boardTitle,

                collectionTitle,
                rowsToDisplay: parseInt(rowsToDisplay),
                sortRowsBy,
                collectionImg,
                collectionCount,
                collectionStatus,
                titleTextColor,
                backgroundColor,
                columnConfiguration: columns,
                status: true,
                collectionId: collectionIdDB,
                products: {
                    create: boardProducts
                },
                shopId: shop
            }
        });

        return json({ success: true, board: newBoard, updated: false });
    }

}

export const deleteBoard = async (admin, formData, shop) => {
    const boardId = formData.get('boardId');

    await prisma.productOnBoard.deleteMany({
        where: { boardId: boardId, shopId: shop },
    });
    await prisma.board.delete({
        where: { id: boardId, shopId: shop }
    });
    return json({ success: true });


}


export const toggleBoard = async (admin, formData, shop) => {
    const boardToggleId = formData.get('boardId');
    const newStatus = formData.get('newStatus') === 'true'; // Convert string to boolean
    await prisma.board.update({
        where: { id: boardToggleId, shopId: shop },
        data: { status: newStatus },
    });
    return json({ success: true });



}
