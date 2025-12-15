import React, { Fragment, useState } from "react";
import CommonModal from "../../../packages/BaseModel";
import {
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Row,
  Col,
  Card,
  CardBody,
} from "reactstrap";
import axiosClient from "../../AxiosClint";
import { toast } from "react-toastify";
import { addNewItem, validateFields } from "@/packages/help";

const NewModal = (props) => {
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [notification, setNotification] = useState("");
  const [interval, setInterval] = useState(10);
  const [rules, setRules] = useState([]);
  const [saving, setSaving] = useState(false);

  const addRule = () => {
    setRules([
      ...rules,
      { id: Date.now(), conditions: [{ key: "", value: "" }] },
    ]);
  };

  const removeRule = (ruleId) => {
    setRules(rules.filter((rule) => rule.id !== ruleId));
  };

  const addCondition = (ruleId) => {
    setRules(
      rules.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditions: [...rule.conditions, { key: "", value: "" }],
          };
        }
        return rule;
      })
    );
  };

  const removeCondition = (ruleId, conditionIndex) => {
    setRules(
      rules.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditions: rule.conditions.filter(
              (_, idx) => idx !== conditionIndex
            ),
          };
        }
        return rule;
      })
    );
  };

  const updateCondition = (ruleId, conditionIndex, field, value) => {
    setRules(
      rules.map((rule) => {
        if (rule.id === ruleId) {
          const newConditions = [...rule.conditions];
          newConditions[conditionIndex][field] = value;
          return { ...rule, conditions: newConditions };
        }
        return rule;
      })
    );
  };

  const resetForm = () => {
    setName("");
    setAccount("");
    setPassword("");
    setNotification("");
    setInterval(10);
    setRules([]);
  };

  const handleSave = async () => {
    if (
      !validateFields(
        { name, account, password },
        "Please fill all required fields"
      )
    ) {
      return;
    }

    const setupData = {
      account: account,
      password: password,
      notification: notification,
      interval: interval,
      rules: rules.map((rule) => {
        const ruleObj = {};
        rule.conditions.forEach((cond) => {
          if (cond.key && cond.value) {
            ruleObj[cond.key] = cond.value.includes(",")
              ? cond.value.split(",").map((v) => v.trim())
              : cond.value;
          }
        });
        return ruleObj;
      }),
    };

    const data = {
      name,
      account,
      setup: setupData,
      provider: "welocalize",
    };

    setSaving(true);

    const result = await addNewItem(axiosClient, "api/AddNewAutomation", data, {
      loading: "Adding automation...",
      success: "Automation added successfully!",
      error: "Failed to add automation",
      internalError: "Failed to add automation",
    });

    setSaving(false);

    if (result.success) {
      const responseData = result.data;

      const newItem = {
        id: responseData.id,
        name: name,
        account: account,
        setup: setupData,
        created_at: responseData.created_at || new Date().toISOString(),
      };

      if (props.onSuccess) {
        props.onSuccess(newItem);
      }

      props.toggler();
      resetForm();
    }
  };

  return (
    <Fragment>
      <CommonModal
        isOpen={props.modal}
        toggler={props.toggler}
        title="Add new automation"
        onSave={handleSave}
        size={"xl"}
        marginTop={"-1%"}
        icon={props.icon}
        saving={saving}
      >
        <div className="mb-4">
          <h5 className="border-bottom pb-2 mb-3">Basic Configuration</h5>

          <Form>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label for="name">
                    Name <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter automation name"
                    disabled={saving}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label for="account">
                    Account <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    id="account"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder="Enter account email"
                    disabled={saving}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label for="password">
                    Password <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={saving}
                  />
                </FormGroup>
              </Col>

              <Col md={6}>
                <FormGroup>
                  <Label for="notification">Notification Account</Label>
                  <Input
                    type="text"
                    id="notification"
                    value={notification}
                    onChange={(e) => setNotification(e.target.value)}
                    placeholder="Enter notification email"
                    disabled={saving}
                  />
                </FormGroup>
              </Col>

              <Col md={6}>
                <FormGroup>
                  <Label for="interval">Interval (minutes)</Label>
                  <Input
                    type="number"
                    id="interval"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    min="1"
                    placeholder="10"
                    disabled={saving}
                  />
                </FormGroup>
              </Col>
            </Row>
          </Form>
        </div>

        <div>
          <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <h5 className="mb-0">Match Rules</h5>
            <Button
              color="primary"
              size="sm"
              onClick={addRule}
              disabled={saving}
            >
              <i className="bi bi-plus-circle me-1"></i>
              Add Rule
            </Button>
          </div>

          {rules.length === 0 && (
            <div className="text-center text-muted py-4">
              No rules added yet. Click "Add Rule" to create your first rule.
            </div>
          )}

          {rules.map((rule, ruleIndex) => (
            <Card key={rule.id} className="mb-3 shadow-sm">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0 fw-bold">Rule #{ruleIndex + 1}</h6>
                  <div className="d-flex gap-2">
                    <Button
                      color="success"
                      size="sm"
                      outline
                      onClick={() => addCondition(rule.id)}
                      disabled={saving}
                    >
                      + Condition
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      outline
                      onClick={() => removeRule(rule.id)}
                      disabled={saving}
                    >
                      Remove Rule
                    </Button>
                  </div>
                </div>

                {rule.conditions.map((condition, condIndex) => (
                  <Row key={condIndex} className="mb-2 align-items-end">
                    <Col md={5}>
                      <FormGroup>
                        <Label size="sm">Condition Key</Label>
                        <Input
                          type="text"
                          size="sm"
                          value={condition.key}
                          onChange={(e) =>
                            updateCondition(
                              rule.id,
                              condIndex,
                              "key",
                              e.target.value
                            )
                          }
                          placeholder="Key"
                          disabled={saving}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        <Label size="sm">Condition Value</Label>
                        <Input
                          type="text"
                          size="sm"
                          value={condition.value}
                          onChange={(e) =>
                            updateCondition(
                              rule.id,
                              condIndex,
                              "value",
                              e.target.value
                            )
                          }
                          placeholder="Value (comma-separated for multiple)"
                          disabled={saving}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={1}>
                      <FormGroup>
                        <Button
                          color="danger"
                          size="sm"
                          onClick={() => removeCondition(rule.id, condIndex)}
                          title="Remove Condition"
                          disabled={saving}
                        >
                          ×
                        </Button>
                      </FormGroup>
                    </Col>
                  </Row>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      </CommonModal>
    </Fragment>
  );
};

export default NewModal;
