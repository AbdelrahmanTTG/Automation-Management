import React, { Fragment, useState, useCallback, useEffect } from "react";
import { Col, Card, CardBody, Button } from "reactstrap";
import NavComponent from "./NavComponent";
import BodyComponent from "./BodyComponent";
import ModalComponent from "./Model";
import axiosClient from "../../AxiosClint";
import { toast } from "react-toastify";
import { updateItem, deleteItem, fetchItems } from "@/packages/help";

const LiftBar = () => {
  const [activeTab, setActiveTab] = useState("");
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const result = await fetchItems(
      axiosClient,
      "api/configs",
      {
        error: "Failed to load configurations",
      },
      "welocalize"
    );
    if (result.success) {
      setConfig(result.data);
    }
    setLoading(false);
  };

  const callback = useCallback(
    (id) => {
      setActiveTab(id);
      const filteredUsers = config.filter((item) => item.id === Number(id));
      setUsers(filteredUsers);
    },
    [config]
  );

  const handleAddNew = (newItem) => {
    const formattedItem = {
      ...newItem,
      id: newItem.id,
      name: newItem.name,
      account: newItem.account || newItem.setup?.account,
      setup: newItem.setup,
      created_at: newItem.created_at || new Date().toISOString(),
    };

    setConfig((prev) => [...prev, formattedItem]);
    setActiveTab(formattedItem.id.toString());
    setUsers([formattedItem]);
    toast.success("Automation added successfully!");
  };

  const handleUpdateUser = async (userId, updatedData) => {
    const result = await updateItem(
      axiosClient,
      "api/UpdateAutomation",
      userId,
      {
        name: updatedData.name,
        setup: updatedData.setup,
      },
      {
        loading: "Updating...",
        success: "Updated successfully!",
        error: "Update failed",
        internalError: "Failed to update automation",
      }
    );

    if (result.success) {
      setConfig((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                ...updatedData,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                ...updatedData,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
    }
  };

  const handleDeleteUser = async (userId) => {
    const result = await deleteItem(
      axiosClient,
      "api/DeleteAutomation",
      userId,
      {
        confirmTitle: "Are you sure?",
        confirmText: "You won't be able to revert this!",
        confirmButton: "Yes, delete it!",
        cancelButton: "Cancel",
        loading: "Deleting...",
        successTitle: "Deleted!",
        successText: "Automation has been deleted.",
        error: "Delete failed",
        internalError: "Failed to delete automation",
      }
    );

    if (result.success) {
      setConfig((prev) => prev.filter((item) => item.id !== userId));
      setUsers((prev) => prev.filter((item) => item.id !== userId));

      if (users.length === 1 && config.length > 1) {
        const remainingConfigs = config.filter((item) => item.id !== userId);
        if (remainingConfigs.length > 0) {
          setActiveTab(remainingConfigs[0].id.toString());
          setUsers([remainingConfigs[0]]);
        }
      }
    }
  };

  const toggleModal = () => setIsModalOpen((prev) => !prev);

  return (
    <Fragment>
      <Col xl="3" className="xl-30">
        <Card>
          <CardBody className="d-flex flex-column align-items-center p-0">
            <div
              className="w-100 d-flex flex-column align-items-center justify-content-center"
              style={{ padding: "20px 0", borderBottom: "1px solid #ddd" }}
            >
              <i
                className="fa fa-reddit-alien"
                style={{ fontSize: "35px" }}
              ></i>
              <h6 style={{ marginTop: "10px", fontSize: "15px" }}>
                Welocalize
              </h6>
              <Button
                color="primary"
                size="sm"
                style={{ marginTop: "10px" }}
                onClick={toggleModal}
              >
                Add New
              </Button>
            </div>
            <div className="w-100" style={{ flex: 1, overflowY: "auto" }}>
              <NavComponent
                callbackActive={callback}
                config={config}
                loading={loading}
              />
            </div>
          </CardBody>
        </Card>
      </Col>
      <Col xl="9" md="12" className="box-col-12 xl-70">
        <div className="email-right-aside bookmark-tabcontent contacts-tabs">
          <div className="email-body radius-left">
            <div className="pl-0">
              <BodyComponent
                activeTab={activeTab}
                users={users}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
              />
            </div>
          </div>
        </div>
      </Col>
      <ModalComponent
        modal={isModalOpen}
        toggler={toggleModal}
        onSuccess={handleAddNew}
      />
    </Fragment>
  );
};

export default LiftBar;
