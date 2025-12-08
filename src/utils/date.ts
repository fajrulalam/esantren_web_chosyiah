import { Timestamp } from "firebase/firestore";

export const formatDate = (timestamp: Timestamp) => {
  const date = timestamp.toDate();
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const formatDateOnly = (timestamp: Timestamp) => {
  const date = timestamp.toDate();
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

export const formatISODate = (date: Date) => {
  return date.toISOString().split('T')[0];
};