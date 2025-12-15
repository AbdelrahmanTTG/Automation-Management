import { toast } from "react-toastify";
import Swal from "sweetalert2";

export const convertToArray = (data, fields) => {
  if (Array.isArray(data)) return data;
  return fields.map(
    (field) =>
      data?.[field] ?? (field === "rules" ? [] : field === "interval" ? 10 : "")
  );
};

export const convertToObject = (dataArray, fields) => {
  if (!Array.isArray(dataArray)) return dataArray;
  const obj = {};
  fields.forEach((field, index) => {
    obj[field] =
      dataArray[index] ??
      (field === "rules" ? [] : field === "interval" ? 10 : "");
  });
  return obj;
};

export const parseValue = (value, delimiter = ",") => {
  if (typeof value === "string") {
    return value
      .split(delimiter)
      .map((v) => v.trim())
      .filter((v) => v);
  }
  return value;
};

export const getStatusColor = (status, colorMap) => {
  return colorMap[status] || colorMap.default || "gray";
};

export const getStatusIcon = (status, iconMap) => {
  return (
    iconMap[status] || iconMap.default || "icofont icofont-question-circle"
  );
};

export const checkStatus = async (item, endpoint, payload) => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(item)),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    return {
      exists: data?.exists,
      data: data,
    };
  } catch (error) {
    console.error("Error fetching status:", error);
    return {
      exists: false,
      data: null,
    };
  }
};

export const startProcess = async (item, endpoint, payload, messages = {}) => {
  const loadingToast = toast.loading(messages.loading || "Starting...");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(item)),
    });

    const data = await response.json();
    toast.dismiss(loadingToast);

    if (!response.ok || data.error) {
      console.error(data.error || "Failed to start");
      toast.error(data.error || messages.error || "Failed to start");
      return { success: false, data };
    }

    toast.success(messages.success || "Started successfully!");
    return { success: true, data };
  } catch (error) {
    toast.dismiss(loadingToast);
    console.error(error);
    toast.error(messages.internalError || "Internal error");
    return { success: false, error };
  }
};

export const stopProcess = async (item, endpoint, payload, messages = {}) => {
  const loadingToast = toast.loading(messages.loading || "Stopping...");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(item)),
    });

    const data = await response.json();
    toast.dismiss(loadingToast);

    if (!response.ok || data.error) {
      console.error(data.error || "Failed to stop");
      toast.error(data.error || messages.error || "Failed to stop");
      return { success: false, data };
    }

    toast.success(messages.success || "Stopped successfully!");
    return { success: true, data };
  } catch (error) {
    toast.dismiss(loadingToast);
    console.error(error);
    toast.error(messages.internalError || "Internal error");
    return { success: false, error };
  }
};

export const updateItem = async (
  axiosClient,
  endpoint,
  itemId,
  updatedData,
  messages = {}
) => {
  const loadingToast = toast.loading(messages.loading || "Updating...");

  try {
    const response = await axiosClient.post(endpoint, {
      id: itemId,
      ...updatedData,
    });

    toast.dismiss(loadingToast);

    if (response.data.success || response.data.message) {
      toast.success(messages.success || "Updated successfully!");
      return { success: true, data: response.data };
    } else {
      toast.error(response.data.message || messages.error || "Update failed");
      return { success: false, data: response.data };
    }
  } catch (error) {
    toast.dismiss(loadingToast);
    console.error("Error updating item:", error);
    toast.error(
      error.response?.data?.message ||
        messages.internalError ||
        "Failed to update"
    );
    return { success: false, error };
  }
};

export const deleteItem = async (
  axiosClient,
  endpoint,
  itemId,
  messages = {}
) => {
  const result = await Swal.fire({
    title: messages.confirmTitle || "Are you sure?",
    text: messages.confirmText || "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: messages.confirmButton || "Yes, delete it!",
    cancelButtonText: messages.cancelButton || "Cancel",
  });

  if (!result.isConfirmed) {
    return { success: false, cancelled: true };
  }

  const loadingToast = toast.loading(messages.loading || "Deleting...");

  try {
    const response = await axiosClient.delete(`${endpoint}/${itemId}`);

    toast.dismiss(loadingToast);

    if (response.data.success) {
      Swal.fire({
        title: messages.successTitle || "Deleted!",
        text: messages.successText || "Item has been deleted.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      return { success: true, data: response.data };
    } else {
      toast.error(response.data.message || messages.error || "Delete failed");
      return { success: false, data: response.data };
    }
  } catch (error) {
    toast.dismiss(loadingToast);
    console.error("Error deleting item:", error);
    toast.error(
      error.response?.data?.message ||
        messages.internalError ||
        "Failed to delete"
    );
    return { success: false, error };
  }
};

export const addNewItem = async (
  axiosClient,
  endpoint,
  data,
  messages = {}
) => {
  const loadingToast = toast.loading(messages.loading || "Adding...");

  try {
    const response = await axiosClient.post(endpoint, data);

    toast.dismiss(loadingToast);

    if (response.data.success || response.data.data) {
      const responseData = response.data.data || response.data;
      return { success: true, data: responseData };
    } else {
      toast.error(response.data.message || messages.error || "Failed to add");
      return { success: false, data: response.data };
    }
  } catch (err) {
    toast.dismiss(loadingToast);
    console.error("Failed to save data:", err);
    toast.error(
      err.response?.data?.message || messages.internalError || "Failed to add"
    );
    return { success: false, error: err };
  }
};

export const fetchItems = async (axiosClient, endpoint, messages = {}, provider) => {
  try {
    const response = await axiosClient.post(endpoint, { provider: provider });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error("Error fetching items:", error);
    toast.error(messages.error || "Failed to load data");
    return { success: false, error };
  }
};

export const formatDate = (dateString, options = {}) => {
  const defaultOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Date(dateString).toLocaleString("en-US", {
    ...defaultOptions,
    ...options,
  });
};

export const validateFields = (fields, customMessage) => {
  const missingFields = [];

  Object.entries(fields).forEach(([key, value]) => {
    if (!value || (typeof value === "string" && !value.trim())) {
      missingFields.push(key);
    }
  });

  if (missingFields.length > 0) {
    toast.warning(
      customMessage ||
        `Please fill all required fields: ${missingFields.join(", ")}`
    );
    return false;
  }

  return true;
};

export const useDataEditor = (fieldsList) => {
  const [editedData, setEditedData] = React.useState({});

  const updateField = (fieldIndex, value) => {
    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    newData[fieldIndex] = value;
    setEditedData({ ...editedData, data: newData });
  };

  const updateNestedField = (parentIndex, childIndex, key, value) => {
    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    const items = [...(newData[parentIndex] || [])];
    items[childIndex] = { ...items[childIndex], [key]: value };
    newData[parentIndex] = items;
    setEditedData({ ...editedData, data: newData });
  };

  const addNestedItem = (parentIndex, defaultItem = {}) => {
    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    const items = [...(newData[parentIndex] || [])];
    items.push(defaultItem);
    newData[parentIndex] = items;
    setEditedData({ ...editedData, data: newData });
  };

  const deleteNestedItem = (parentIndex, childIndex) => {
    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    const items = [...(newData[parentIndex] || [])];
    items.splice(childIndex, 1);
    newData[parentIndex] = items;
    setEditedData({ ...editedData, data: newData });
  };

  const updateNestedKey = (parentIndex, childIndex, oldKey, newKey) => {
    if (oldKey === newKey) return;

    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    const items = [...(newData[parentIndex] || [])];
    const item = { ...(items[childIndex] || {}) };

    const value = item[oldKey];
    delete item[oldKey];
    item[newKey] = value;

    items[childIndex] = item;
    newData[parentIndex] = items;
    setEditedData({ ...editedData, data: newData });
  };

  const deleteNestedKey = (parentIndex, childIndex, keyToDelete) => {
    const currentData = Array.isArray(editedData.data)
      ? editedData.data
      : convertToArray(editedData.data, fieldsList);

    const newData = [...currentData];
    const items = [...(newData[parentIndex] || [])];
    const { [keyToDelete]: _, ...rest } = items[childIndex] || {};
    items[childIndex] = rest;
    newData[parentIndex] = items;
    setEditedData({ ...editedData, data: newData });
  };

  return {
    editedData,
    setEditedData,
    updateField,
    updateNestedField,
    addNestedItem,
    deleteNestedItem,
    updateNestedKey,
    deleteNestedKey,
  };
};
