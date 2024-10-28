import {
  reactExtension,
  useBuyerJourneyIntercept,
  useCartLines,
  useApplyCartLinesChange,
  useEmail,
  Text,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";
export default reactExtension(
  "purchase.checkout.cart-line-list.render-after",
  () => <Extension />
);

function Extension() {
  const lines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();
  const user = useEmail();
  const [subscriptionChecker, setSubscriptionChecker] = useState(false);
  const [removedCheck, setRemovedCheck] = useState(false);

  const [freeProductIds, setFreeProductIds] = useState([]);

  async function handleRemoveToCart(variantId) {
    const result = await applyCartLinesChange({
      type: "removeCartLine",
      id: variantId,
      quantity: 1,
    });

    if (result.type === "error") {
      console.error(result.message);
    }
  }

  function searchCustomerByEmail(email) {
    console.log(email);
    console.log(lines);

    // The URL to the server-side endpoint you provided
    const endpoint =
      " https://revival-customer-search-20c0e7f7ec2f.herokuapp.com/customerSearch";

    // The payload you want to send, in this case just an email address
    const data = {
      email: email,
    };

    // Using fetch to send a POST request
    return fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    });
  }

  useEffect(() => {
    console.log(lines);
    lines.forEach((item) => {
      if (
        (item.merchandise.title == "30 Pack" ||
          item.merchandise.title == "12 Pack") &&
        item.merchandise?.sellingPlan
      ) {
        setSubscriptionChecker(true);
      }
      if (
        item.merchandise.title == "Kids Multi-Vitamin Squash" &&
        item.merchandise?.selectedOptions[0]?.value?.includes("30 Pack") &&
        item.merchandise?.sellingPlan
      ) {
        setSubscriptionChecker(true);
      }
      if (
        (item.merchandise.title == "Steel Water Bottle" ||
          item.merchandise.title == "Kids Steel Water Bottle") &&
        item.cost.totalAmount.amount == 0.0
      ) {
        let productId = [];
        productId = freeProductIds;
        productId.push(item.id);
        setFreeProductIds([...productId]);
      }
    });
    async function removeExtraProduct() {
      if (user?.includes("@")) {
        const customers = await searchCustomerByEmail(user);
        console.log("right before orders");
        console.log(customers);
        let subscriptionDetectionFlag = false;
        customers.forEach((item) => {
          if (
            item.tags?.includes("Subscription") ||
            item.customer.tags?.includes("free_product_redeemed")
          ) {
            subscriptionDetectionFlag = true;
          }
        });
        if (subscriptionDetectionFlag && freeProductIds.length != 0) {
          const processItemsSequentially = async () => {
            for (const item of freeProductIds) {
              await handleAddToCart(item);
            }
          };

          processItemsSequentially();
          setRemovedCheck(true);
        }
      }
    }
    removeExtraProduct();
  }, [user]);

  async function handleAddToCart(id) {
    const result = await applyCartLinesChange({
      type: "removeCartLine",
      id: id,
      quantity: 1,
    });
    console.log(result);
  }

  return removedCheck ? (
    <Text size="medium">
      {" "}
      Free product removed - It looks like you have previously claimed the free
      gift!
    </Text>
  ) : null;
}
