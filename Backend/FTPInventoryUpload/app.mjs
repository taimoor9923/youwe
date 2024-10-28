import FTPClient from "ftp";
import XlsxPopulate from "xlsx-populate";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASS,
};

const shopifyConfig = {
  UKStore: {
    store: process.env.SHOPIFY_STORE_UK,
    apiKey: process.env.SHOPIFY_API_KEY_UK,
    password: process.env.SHOPIFY_PASSWORD_UK,
  },
  USStore: {
    store: process.env.SHOPIFY_STORE_US,
    apiKey: process.env.SHOPIFY_API_KEY_US,
    password: process.env.SHOPIFY_PASSWORD_US,
  },
};
const locationLoughborough = "xxxx";

const filesToProcess = [
  {
    filePath:
      "Shared/EgnyteData/Order Forms/Customer/Heros-Spiral-OrderForm-UK+EU.xlsx",
    localPath: "local-order-form.xlsx",
    newLocalPath: "Heros-Spiral-OrderForm-UK+EU.xlsx",
    uploadPath: "Heros-Spiral-OrderForm-UK+EU.xlsx",
    changeDirectoryFlag: true,
  },
  {
    filePath:
      "Shared/EgnyteData/Order Forms/Customer/Spiral-OrderForm-Retail-UK+EU.xlsx",
    localPath: "local-retail-order-form.xlsx",
    newLocalPath: "Spiral-OrderForm-Retail-UK+EU.xlsx",
    uploadPath: "Spiral-OrderForm-Retail-UK+EU.xlsx",
    changeDirectoryFlag: false,
  },
  {
    filePath:
      "Shared/EgnyteData/Order Forms/Customer/Spiral-OrderForm-Retail-US.xlsx",
    localPath: "local-us-order-form.xlsx",
    newLocalPath: "Spiral-OrderForm-Retail-US.xlsx",
    uploadPath: "Spiral-OrderForm-Retail-US.xlsx",
    changeDirectoryFlag: false,
  },
  {
    filePath: "Shared/EgnyteData/Order Forms/Customer/EMP-Spiral-UK+EU.xlsx",
    localPath: "local-emp-order-form.xlsx",
    newLocalPath: "EMP-Spiral-UK+EU.xlsx",
    uploadPath: "EMP-Spiral-UK+EU.xlsx",
    changeDirectoryFlag: false,
  },
];

const downloadFile = (client, remotePath, localPath) => {
  return new Promise((resolve, reject) => {
    client.get(remotePath, (err, stream) => {
      if (err) return reject(err);
      stream.once("close", () => resolve());
      stream.pipe(fs.createWriteStream(localPath));
    });
  });
};

const uploadFile = (client, localPath, remotePath) => {
  return new Promise((resolve, reject) => {
    client.put(localPath, remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const listFiles = (client, remotePath) => {
  return new Promise((resolve, reject) => {
    client.list(remotePath, (err, list) => {
      if (err) return reject(err);
      resolve(list);
    });
  });
};

const getShopifyProducts = async (shopifyConfig) => {
  const allProducts = [];
  let url = `https://${shopifyConfig.store}/admin/api/2024-04/products.json?limit=250`;
  let hasMoreProducts = true;

  while (hasMoreProducts) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${shopifyConfig.apiKey}:${shopifyConfig.password}`
        ).toString("base64")}`,
      },
    });
    const data = await response.json();
    allProducts.push(...data.products);

    if (data.products.length < 250) {
      hasMoreProducts = false;
    } else {
      const nextLink = response.headers
        .get("link")
        ?.split(",")
        .find((s) => s.includes('rel="next"'));
      if (nextLink) {
        url = nextLink.match(/<(.*?)>/)[1];
      } else {
        hasMoreProducts = false;
      }
    }
  }

  return allProducts;
};

const changeDirectory = (client, path) => {
  return new Promise((resolve, reject) => {
    client.cwd(path, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const getInventoryLevels = async (inventoryItemIds, shopifyStoreConfig) => {
  const url = `https://${
    shopifyStoreConfig.store
  }/admin/api/2024-01/inventory_levels.json?location_ids=${locationLoughborough}&inventory_item_ids=${inventoryItemIds.join(
    ","
  )}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${shopifyStoreConfig.apiKey}:${shopifyStoreConfig.password}`
      ).toString("base64")}`,
    },
  });
  const data = await response.json();
  return data.inventory_levels;
};

const getInventoryLevelsUS = async (inventoryItemIds, shopifyStoreConfig) => {
  const url = `https://${
    shopifyStoreConfig.store
  }/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemIds.join(
    ","
  )}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${shopifyStoreConfig.apiKey}:${shopifyStoreConfig.password}`
      ).toString("base64")}`,
    },
  });
  const data = await response.json();
  return data.inventory_levels;
};

const processFile = async (client, fileInfo, products, skuToStockMap) => {
  const { filePath, localPath, newLocalPath, uploadPath, changeDirectoryFlag } =
    fileInfo;

  // Download the file
  await downloadFile(client, filePath, localPath);

  // Read and parse the file using xlsx-populate
  const workbook = await XlsxPopulate.fromFileAsync(localPath);
  const sheet = workbook.sheet(0);

  // Determine the starting row and columns based on the file name
  let startRow = 6;
  let skuColumn = "D";
  let stockColumn = "H";
  let columnToFormat = "J";
  let EMPcolumn = "E";

  // Update stock values in the file
  for (
    let rowNumber = startRow;
    rowNumber <= sheet.usedRange().endCell().rowNumber();
    rowNumber++
  ) {
    const skuCell = sheet.cell(`${skuColumn}${rowNumber}`);
    const stockCell = sheet.cell(`${stockColumn}${rowNumber}`);
    const sku = skuCell.value();
    const columnJCell = sheet.cell(`${columnToFormat}${rowNumber}`);
    const columnEMPCell = sheet.cell(`${EMPcolumn}${rowNumber}`);
    columnEMPCell.value(String(columnEMPCell.value()));
    // Explicitly convert to string
    if (filePath.includes("Spiral-OrderForm-Retail-US.xlsx")) {
      columnJCell.value(String(columnJCell.value())); // Explicitly convert to string
    }

    if (sku && skuToStockMap[sku] !== undefined) {
      stockCell.value(skuToStockMap[sku]);
    }
  }

  // Save the updated file with a new name
  await workbook.toFileAsync(newLocalPath);

  // await changeDirectory(client, 'Shared/EgnyteData/Order Forms/Customer'); // Move outside the loop

  // // Upload the new file to the FTP server
  // await uploadFile(client, newLocalPath, uploadPath);
  // await changeDirectory(client, '/'); // Move outside the loop

  console.log(`Stock values updated and ${newLocalPath} saved successfully`);
};

const main = async () => {
  const client = new FTPClient();
  client.on("ready", async () => {
    try {
      // Fetch products and inventory for UK store
      const ukProducts = await getShopifyProducts(shopifyConfig.UKStore);

      const ukSkuToInventoryItemIdMap = {};
      const ukInventoryItemIds = [];

      ukProducts.forEach((product) => {
        product.variants.forEach((variant) => {
          ukSkuToInventoryItemIdMap[variant.sku] = variant.inventory_item_id;
          ukInventoryItemIds.push(variant.inventory_item_id);
        });
      });

      const ukSkuToStockMap = {};
      const chunkSize = 50;

      for (let i = 0; i < ukInventoryItemIds.length; i += chunkSize) {
        const chunk = ukInventoryItemIds.slice(i, i + chunkSize);
        const inventoryLevels = await getInventoryLevels(
          chunk,
          shopifyConfig.UKStore
        );

        inventoryLevels.forEach((level) => {
          const sku = Object.keys(ukSkuToInventoryItemIdMap).find(
            (sku) => ukSkuToInventoryItemIdMap[sku] === level.inventory_item_id
          );
          if (sku) {
            ukSkuToStockMap[sku] = level.available;
          }
        });
      }

      // Fetch products and inventory for US store
      const usProducts = await getShopifyProducts(shopifyConfig.USStore);

      const usSkuToStockMap = {};
      usProducts.forEach((product) => {
        product.variants.forEach((variant, index) => {
          usSkuToStockMap[variant.sku] = variant.inventory_quantity;
        });
      });

      // Process UK files
      for (const fileInfo of filesToProcess.filter(
        (file) => !file.filePath.includes("US")
      )) {
        await processFile(client, fileInfo, ukProducts, ukSkuToStockMap);
      }

      // Process US files
      for (const fileInfo of filesToProcess.filter((file) =>
        file.filePath.includes("US")
      )) {
        await processFile(client, fileInfo, usProducts, usSkuToStockMap);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      client.end();
    }
  });

  client.connect(ftpConfig);
};

main();
