"use client";

import { useState } from "react";
import { DELIVERY_SELECT_SENTINEL } from "@/lib/pickup-options";

export function useStorefrontCheckoutForm() {
  const [nickname, setNickname] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [pickupLocation, setPickupLocation] = useState(
    DELIVERY_SELECT_SENTINEL,
  );
  const [note, setNote] = useState("");
  const [saveProfile, setSaveProfile] = useState(false);

  return {
    nickname,
    setNickname,
    purchaserName,
    setPurchaserName,
    recipientName,
    setRecipientName,
    phone,
    setPhone,
    address,
    setAddress,
    email,
    setEmail,
    pickupLocation,
    setPickupLocation,
    note,
    setNote,
    saveProfile,
    setSaveProfile,
  };
}
