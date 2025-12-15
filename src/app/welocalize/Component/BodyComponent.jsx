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
} from "reactstrap";
import { toast } from "react-toastify";
import {
  convertToArray,
  convertToObject,
  parseValue,
  getStatusColor,
  getStatusIcon,
  checkStatus,
  startProcess,
  stopProcess,
} from "@/packages/help";

const BodyComponent = ({ activeTab, users, onUpdateUser, onDeleteUser }) => {
  const [editingUserId, setEditingUserId] = useState(null);
  const [status, setStatus] = useState(null);
  const [dataProcess, setDataProcess] = useState({});
  const [editedData, setEditedData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    default: "gray",
  };

  const statusIconMap = {
    online: "icofont icofont-check-circled",
    stopped: "icofont icofont-stop",
    errored: "icofont icofont-close-circled",
    launching: "icofont icofont-spinner-alt-2",
    "waiting restart": "icofont icofont-refresh",
    default: "icofont icofont-question-circle",
  };

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

  const checkAutomationStatus = async (user) => {
    const result = await checkStatus(
      user,
      "/api/automation/status",
      (item) => ({
        user: {
          name: item?.name,
          id: item?.id,
        },
      })
    );
    setStatus(result.exists);
    setDataProcess(result.data || {});
  };

  useEffect(() => {
    if (users && users.length > 0) {
      checkAutomationStatus(users[0]);
    }
  }, [users]);

  const handleStart = async (user, scriptName = "welocalize.js") => {
    if (isProcessing) return;

    setIsProcessing(true);
    const result = await startProcess(
      user,
      "/api/automation/start",
      (item) => ({ user: item, scriptName }),
      {
        loading: "Starting automation...",
        success: "Automation started successfully!",
        error: "Failed to start automation",
        internalError: "Internal error starting automation",
      }
    );
    setIsProcessing(false);

    if (result.success) {
      checkAutomationStatus(user);
    }
  };

  const handleStop = async (user) => {
    if (isProcessing) return;

    setIsProcessing(true);
    const result = await stopProcess(
      user,
      "/api/automation/stop",
      (item) => ({ user: item }),
      {
        loading: "Stopping automation...",
        success: "Automation stopped successfully!",
        error: "Failed to stop automation",
        internalError: "Internal error stopping automation",
      }
    );
    setIsProcessing(false);

    if (result.success) {
      checkAutomationStatus(user);
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
                              {status !== null ? (
                                <small style={{ fontSize: "1rem" }}>
                                  (
                                  {dataProcess.status ? (
                                    <>
                                      <span
                                        style={{
                                          color: getStatusColor(
                                            dataProcess.status,
                                            statusColorMap
                                          ),
                                          marginRight: "4px",
                                        }}
                                      >
                                        {dataProcess.status}
                                      </span>
                                      <i
                                        className={getStatusIcon(
                                          dataProcess.status,
                                          statusIconMap
                                        )}
                                        style={{
                                          fontSize: "0.9rem",
                                          color: getStatusColor(
                                            dataProcess.status,
                                            statusColorMap
                                          ),
                                        }}
                                      ></i>
                                    </>
                                  ) : (
                                    <span style={{ color: "gray" }}>
                                      Not found process
                                    </span>
                                  )}
                                  )
                                </small>
                              ) : (
                                <></>
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
                              {status !== null && (
                                <>
                                  {dataProcess.status === "stopped" ||
                                  dataProcess.status === "errored" ||
                                  dataProcess.status === "Not found process" ||
                                  dataProcess.status === "launching" ||
                                  dataProcess.status === "waiting restart" ? (
                                    <Button
                                      color="success"
                                      size="sm"
                                      outline
                                      onClick={() => handleStart(user)}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? (
                                        <span className="spinner-border spinner-border-sm"></span>
                                      ) : (
                                        "Run"
                                      )}
                                    </Button>
                                  ) : dataProcess.status === "online" ? (
                                    <Button
                                      color="danger"
                                      size="sm"
                                      outline
                                      onClick={() => handleStop(user)}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? (
                                        <span className="spinner-border spinner-border-sm"></span>
                                      ) : (
                                        "Stop"
                                      )}
                                    </Button>
                                  ) : null}
                                </>
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
