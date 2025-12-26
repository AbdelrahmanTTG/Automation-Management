import React, { Fragment, useEffect, useState } from "react";
import {
  TabContent,
  TabPane,
  CardBody,
  Card,
  Row,
  Col,
  Badge,
  Button,
  Input,
  FormGroup,
  Label,
  Spinner,
} from "reactstrap";
import { toast } from "react-toastify";
import {
  convertToArray,
  convertToObject,
  parseValue,
  getStatusColor,
  getStatusIcon,
} from "@/packages/help";

const BodyComponent = ({ activeTab, users, onUpdateUser, onDeleteUser }) => {
  const [editingUserId, setEditingUserId] = useState(null);
  const [processStatuses, setProcessStatuses] = useState({});
  const [editedData, setEditedData] = useState({});
  const [isProcessing, setIsProcessing] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState({});
  const [token, setToken] = useState("");

  const setupFields = [
    "account",
    "password",
    "notification",
    "interval",
    "rules",
  ];

  const statusColorMap = {
    online: "green",
    stopped: "orange",
    errored: "red",
    launching: "blue",
    "waiting restart": "blue",
    "not-found": "gray",
    default: "gray",
  };

  const statusIconMap = {
    online: "icofont icofont-check-circled",
    stopped: "icofont icofont-stop",
    errored: "icofont icofont-close-circled",
    launching: "icofont icofont-spinner-alt-2",
    "waiting restart": "icofont icofont-refresh",
    "not-found": "icofont icofont-question-circle",
    default: "icofont icofont-question-circle",
  };

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/automation/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": users[0]?.id || "default-user",
          },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setToken(data.token);
        }
      } catch (error) {
        console.error("Failed to fetch token:", error);
      }
    };

    if (users && users.length > 0) {
      fetchToken();
    }
  }, [users]);

  const checkAutomationStatus = async (user) => {
    if (!token) return;

    setIsLoadingStatus((prev) => ({ ...prev, [user.id]: true }));

    try {
      const response = await fetch("/api/automation/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          user: {
            name: user.name,
            id: user.id,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setProcessStatuses((prev) => ({
          ...prev,
          [user.id]: {
            exists: result.exists || false,
            status: result.status || "not-found",
            data: result,
          },
        }));
      } else {
        setProcessStatuses((prev) => ({
          ...prev,
          [user.id]: {
            exists: false,
            status: "not-found",
            data: {},
          },
        }));
      }
    } catch (error) {
      console.error("Error checking status:", error);
      setProcessStatuses((prev) => ({
        ...prev,
        [user.id]: {
          exists: false,
          status: "not-found",
          data: {},
        },
      }));
    } finally {
      setIsLoadingStatus((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  useEffect(() => {
    if (users && users.length > 0 && token) {
      users.forEach((user) => {
        checkAutomationStatus(user);
      });
    }
  }, [users, token]);

  const handleEdit = (user) => {
    setEditingUserId(user.id);
    const setupArray = convertToArray(user.setup, setupFields);
    setEditedData({
      name: user.name,
      account: user.account,
      setup: setupArray,
    });
  };

  const handleCancel = () => {
    setEditingUserId(null);
    setEditedData({});
  };

  const handleSave = async (userId) => {
    if (!editedData.name) {
      toast.warning("Name is required");
      return;
    }

    try {
      setIsSaving(true);
      const setupObject = convertToObject(editedData.setup, setupFields);

      if (onUpdateUser) {
        await onUpdateUser(userId, {
          name: editedData.name,
          setup: setupObject,
        });
      }

      setEditingUserId(null);
      setEditedData({});
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (userId) => {
    if (onDeleteUser) {
      onDeleteUser(userId);
    }
  };

  const handleStart = async (user, scriptName = "welocalize.js") => {
    if (isProcessing[user.id] || !token) return;

    setIsProcessing((prev) => ({ ...prev, [user.id]: true }));

    try {
      const response = await fetch("/api/automation/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          user: user,
          scriptName: scriptName,
        }),
      });

      if (response.ok) {
        toast.success("Automation started successfully!");
        await checkAutomationStatus(user);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to start automation");
      }
    } catch (error) {
      console.error("Error starting automation:", error);
      toast.error("Internal error starting automation");
    } finally {
      setIsProcessing((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleStop = async (user) => {
    if (isProcessing[user.id] || !token) return;

    setIsProcessing((prev) => ({ ...prev, [user.id]: true }));

    try {
      const response = await fetch("/api/automation/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          user: user,
        }),
      });

      if (response.ok) {
        toast.success("Automation stopped successfully!");
        await checkAutomationStatus(user);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to stop automation");
      }
    } catch (error) {
      console.error("Error stopping automation:", error);
      toast.error("Internal error stopping automation");
    } finally {
      setIsProcessing((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const updateSetupField = (fieldIndex, value) => {
    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    newSetup[fieldIndex] = value;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const updateRuleField = (ruleIndex, key, value) => {
    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    const rules = [...(newSetup[4] || [])];
    rules[ruleIndex] = { ...rules[ruleIndex], [key]: value };
    newSetup[4] = rules;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const addRule = () => {
    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    const rules = [...(newSetup[4] || [])];
    rules.push({});
    newSetup[4] = rules;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const deleteRule = (ruleIndex) => {
    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    const rules = [...(newSetup[4] || [])];
    rules.splice(ruleIndex, 1);
    newSetup[4] = rules;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const addRuleKeyValue = (ruleIndex) => {
    updateRuleField(ruleIndex, "", "");
  };

  const updateRuleKey = (ruleIndex, oldKey, newKey) => {
    if (oldKey === newKey) return;

    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    const rules = [...(newSetup[4] || [])];
    const rule = { ...(rules[ruleIndex] || {}) };

    const value = rule[oldKey];
    delete rule[oldKey];
    rule[newKey] = value;

    rules[ruleIndex] = rule;
    newSetup[4] = rules;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const deleteRuleKey = (ruleIndex, keyToDelete) => {
    const currentSetup = Array.isArray(editedData.setup)
      ? editedData.setup
      : convertToArray(editedData.setup, setupFields);

    const newSetup = [...currentSetup];
    const rules = [...(newSetup[4] || [])];
    const { [keyToDelete]: _, ...rest } = rules[ruleIndex] || {};
    rules[ruleIndex] = rest;
    newSetup[4] = rules;
    setEditedData({ ...editedData, setup: newSetup });
  };

  const renderSetupData = (setup, user) => {
    const isEditing = editingUserId === user.id;

    if (!setup) {
      return <p className="text-muted">No setup data available</p>;
    }

    let currentSetup;
    if (isEditing) {
      currentSetup = Array.isArray(editedData.setup)
        ? editedData.setup
        : convertToArray(editedData.setup, setupFields);
    } else {
      currentSetup = Array.isArray(setup)
        ? setup
        : convertToArray(setup, setupFields);
    }

    const [account, password, notification, interval, rules] = currentSetup;

    return (
      <div>
        <div className="mb-4">
          <h5 className="border-bottom pb-2 mb-3">Basic Configuration</h5>
          <Row>
            <Col md={6} className="mb-3">
              <FormGroup>
                <Label className="text-muted mb-1">Account</Label>
                {isEditing ? (
                  <Input
                    type="text"
                    value={account || ""}
                    onChange={(e) => updateSetupField(0, e.target.value)}
                    placeholder="Enter account"
                    disabled={isSaving}
                  />
                ) : (
                  <div className="p-3 bg-light rounded">
                    <strong>{account || "N/A"}</strong>
                  </div>
                )}
              </FormGroup>
            </Col>
            <Col md={6} className="mb-3">
              <FormGroup>
                <Label className="text-muted mb-1">Password</Label>
                {isEditing ? (
                  <Input
                    type="password"
                    value={password || ""}
                    onChange={(e) => updateSetupField(1, e.target.value)}
                    placeholder="Enter password"
                    disabled={isSaving}
                  />
                ) : (
                  <div className="p-3 bg-light rounded">
                    <strong>{"•".repeat(password?.length || 8)}</strong>
                  </div>
                )}
              </FormGroup>
            </Col>
            <Col md={6} className="mb-3">
              <FormGroup>
                <Label className="text-muted mb-1">Notification Account</Label>
                {isEditing ? (
                  <Input
                    type="text"
                    value={notification || ""}
                    onChange={(e) => updateSetupField(2, e.target.value)}
                    placeholder="Enter notification account"
                    disabled={isSaving}
                  />
                ) : (
                  <div className="p-3 bg-light rounded">
                    <strong>{notification || "N/A"}</strong>
                  </div>
                )}
              </FormGroup>
            </Col>
            <Col md={6} className="mb-3">
              <FormGroup>
                <Label className="text-muted mb-1">Interval (minutes)</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={interval || "10"}
                    onChange={(e) => updateSetupField(3, e.target.value)}
                    placeholder="Enter interval"
                    disabled={isSaving}
                  />
                ) : (
                  <div className="p-3 bg-light rounded">
                    <strong>{interval || "10"}</strong>
                  </div>
                )}
              </FormGroup>
            </Col>
          </Row>
        </div>

        <div>
          <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <h5 className="mb-0">Match Rules</h5>
            <div className="d-flex gap-2 align-items-center">
              <Badge color="primary" pill>
                {rules?.length || 0} Rules
              </Badge>
              {isEditing && (
                <Button
                  color="success"
                  size="sm"
                  onClick={addRule}
                  disabled={isSaving}
                >
                  <i className="fa fa-plus me-1"></i>
                  Add Rule
                </Button>
              )}
            </div>
          </div>

          {!rules || rules.length === 0 ? (
            <div className="text-center text-muted py-4">
              No rules configured
              {isEditing && (
                <div className="mt-3">
                  <Button
                    color="primary"
                    size="sm"
                    onClick={addRule}
                    disabled={isSaving}
                  >
                    Add First Rule
                  </Button>
                </div>
              )}
            </div>
          ) : (
            rules.map((rule, ruleIndex) => (
              <Card key={ruleIndex} className="mb-3 shadow-sm">
                <CardBody>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0 fw-bold">Rule #{ruleIndex + 1}</h6>
                    {isEditing && (
                      <div className="d-flex gap-2">
                        <Button
                          color="info"
                          size="sm"
                          onClick={() => addRuleKeyValue(ruleIndex)}
                          disabled={isSaving}
                        >
                          <i className="fa fa-plus me-1"></i>
                          Add Field
                        </Button>
                        <Button
                          color="danger"
                          size="sm"
                          onClick={() => deleteRule(ruleIndex)}
                          disabled={isSaving}
                        >
                          <i className="fa fa-trash"></i>
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "30%" }}>Key</th>
                          <th>Value</th>
                          {isEditing && (
                            <th style={{ width: "80px" }}>Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(rule || {}).map(([key, value], idx) => (
                          <tr key={idx}>
                            <td>
                              {isEditing ? (
                                <Input
                                  type="text"
                                  value={key}
                                  onChange={(e) =>
                                    updateRuleKey(
                                      ruleIndex,
                                      key,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter key name"
                                  size="sm"
                                  className="fw-bold"
                                  disabled={isSaving}
                                />
                              ) : (
                                <Badge color="info">{key}</Badge>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <Input
                                  type="text"
                                  value={
                                    Array.isArray(value)
                                      ? value.join(", ")
                                      : value
                                  }
                                  onChange={(e) =>
                                    updateRuleField(
                                      ruleIndex,
                                      key,
                                      parseValue(e.target.value)
                                    )
                                  }
                                  placeholder={
                                    Array.isArray(value)
                                      ? "Comma-separated values"
                                      : "Enter value"
                                  }
                                  size="sm"
                                  disabled={isSaving}
                                />
                              ) : Array.isArray(value) ? (
                                <div className="d-flex flex-wrap gap-1">
                                  {value.map((v, i) => (
                                    <Badge key={i} color="secondary" pill>
                                      {v}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span>{value}</span>
                              )}
                            </td>
                            {isEditing && (
                              <td>
                                <Button
                                  color="danger"
                                  size="sm"
                                  onClick={() => deleteRuleKey(ruleIndex, key)}
                                  disabled={isSaving}
                                >
                                  <i className="fa fa-times"></i>
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {isEditing && Object.keys(rule || {}).length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="text-center text-muted py-3"
                            >
                              <small>
                                No fields added yet. Click "Add Field" to start.
                              </small>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <Fragment>
      <TabContent activeTab={activeTab}>
        <TabPane tabId={activeTab}>
          <Card>
            <CardBody>
              {users.length > 0 ? (
                users.map((user) => {
                  const isEditing = editingUserId === user.id;
                  const userStatus = processStatuses[user.id];
                  const isLoading = isLoadingStatus[user.id];
                  const currentStatus = userStatus?.status || "not-found";

                  return (
                    <div key={user.id}>
                      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                        <div>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={editedData.name}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  name: e.target.value,
                                })
                              }
                              className="mb-2"
                              style={{ maxWidth: "300px" }}
                              disabled={isSaving}
                            />
                          ) : (
                            <h4 className="mb-1">
                              {user.name} |{" "}
                              {isLoading ? (
                                <small>
                                  <Spinner size="sm" color="secondary" />
                                </small>
                              ) : (
                                <small style={{ fontSize: "1rem" }}>
                                  (
                                  <span
                                    style={{
                                      color: getStatusColor(
                                        currentStatus,
                                        statusColorMap
                                      ),
                                      marginRight: "4px",
                                    }}
                                  >
                                    {currentStatus === "not-found"
                                      ? "Not Running"
                                      : currentStatus}
                                  </span>
                                  <i
                                    className={getStatusIcon(
                                      currentStatus,
                                      statusIconMap
                                    )}
                                    style={{
                                      fontSize: "0.9rem",
                                      color: getStatusColor(
                                        currentStatus,
                                        statusColorMap
                                      ),
                                    }}
                                  ></i>
                                  )
                                </small>
                              )}
                            </h4>
                          )}

                          <small className="text-muted">
                            Created at:{" "}
                            {new Date(user.created_at).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                color="success"
                                size="sm"
                                onClick={() => handleSave(user.id)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-1"></span>
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <i className="fa fa-check me-1"></i>
                                    Save
                                  </>
                                )}
                              </Button>
                              <Button
                                color="secondary"
                                size="sm"
                                outline
                                onClick={handleCancel}
                                disabled={isSaving}
                              >
                                <i className="fa fa-times me-1"></i>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                color="primary"
                                size="sm"
                                outline
                                onClick={() => handleEdit(user)}
                              >
                                <i className="fa fa-edit me-1"></i>
                                Edit
                              </Button>
                              <Button
                                color="danger"
                                size="sm"
                                outline
                                onClick={() => handleDelete(user.id)}
                              >
                                <i className="fa fa-trash me-1"></i>
                                Delete
                              </Button>

                              {currentStatus === "online" ? (
                                <Button
                                  color="danger"
                                  size="sm"
                                  outline
                                  onClick={() => handleStop(user)}
                                  disabled={isProcessing[user.id]}
                                >
                                  {isProcessing[user.id] ? (
                                    <span className="spinner-border spinner-border-sm"></span>
                                  ) : (
                                    <>
                                      <i className="fa fa-stop me-1"></i>
                                      Stop
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  color="success"
                                  size="sm"
                                  outline
                                  onClick={() => handleStart(user)}
                                  disabled={isProcessing[user.id]}
                                >
                                  {isProcessing[user.id] ? (
                                    <span className="spinner-border spinner-border-sm"></span>
                                  ) : (
                                    <>
                                      <i className="fa fa-play me-1"></i>
                                      Run
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {renderSetupData(user.setup, user)}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted py-5">
                  <i
                    className="fa fa-inbox"
                    style={{ fontSize: "48px", opacity: 0.3 }}
                  ></i>
                  <p className="mt-3">No configuration selected</p>
                  <small>
                    Select an automation from the sidebar to view details
                  </small>
                </div>
              )}
            </CardBody>
          </Card>
        </TabPane>
      </TabContent>
    </Fragment>
  );
};

export default BodyComponent;
