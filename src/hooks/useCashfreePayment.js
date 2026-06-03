import { useCallback, useState } from "react";
import { auth } from "../services/firebase/config";

const BASE_URL = "https://us-central1-sowin-power.cloudfunctions.net";

async function callFunction(name, data) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User is not logged in");

  const idToken = await currentUser.getIdToken();

  const response = await fetch(`${BASE_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "Cloud Function error");
  return json.result;
}

export function useCashfreePayment() {
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const createOrder = useCallback(async ({ bookingId, amount, customerPhone, customerName }) => {
    setIsCreatingOrder(true);
    try {
      return await callFunction("createCashfreeOrder", {
        bookingId, amount, customerPhone, customerName,
      });
    } finally {
      setIsCreatingOrder(false);
    }
  }, []);

  const verifyOrder = useCallback(async ({ orderId, bookingId }) => {
    return await callFunction("verifyCashfreeOrder", { orderId, bookingId });
  }, []);

  const cancelBooking = useCallback(async ({ bookingId, reason, cancelledByRole }) => {
    return await callFunction("cancelBookingWithRefund", { bookingId, reason, cancelledByRole });
  }, []);

  return { createOrder, verifyOrder, cancelBooking, isCreatingOrder };
}
