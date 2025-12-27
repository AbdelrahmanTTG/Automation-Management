import React from "react";
import { Card, CardBody, Badge, Progress, Row, Col } from "reactstrap";

const ProcessCard = ({ process }) => {
  const formatMemory = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (ms) => {
    if (!ms) return "0m";
    const totalMinutes = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    if (days > 0) {
      const remainingHours = totalHours % 24;
      return `${days}d ${remainingHours}h`;
    }
    if (totalHours > 0) {
      const remainingMinutes = totalMinutes % 60;
      return `${totalHours}h ${remainingMinutes}m`;
    }
    return `${totalMinutes}m`;
  };

  const getStatusColor = (status) => {
    const statusMap = {
      online: "success",
      stopping: "warning",
      stopped: "secondary",
      launching: "info",
      errored: "danger",
      "one-launch-status": "info",
    };
    return statusMap[status] || "dark";
  };

  const getCpuColor = (cpu) => {
    if (cpu >= 80) return "danger";
    if (cpu >= 50) return "warning";
    return "success";
  };

  const hasError = process.status === "errored";
  const highRestarts = (process.restarts || 0) > 5;

  return (
    <Card
      className="shadow-sm h-100"
      style={{
        border: hasError ? "2px solid #dc3545" : "none",
        transition: "all 0.2s ease",
      }}
    >
      <CardBody className="p-3">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h6
              className="mb-1 fw-bold text-truncate"
              style={{ fontSize: "0.95rem" }}
            >
              {process.name}
            </h6>
            <div className="text-muted small">PID: {process.pm_id}</div>
          </div>
          <Badge color={getStatusColor(process.status)} pill className="ms-2">
            {process.status}
          </Badge>
        </div>

        {hasError && (
          <div
            className="mb-3 p-2 d-flex align-items-center gap-2"
            style={{
              backgroundColor: "#f8d7da",
              borderRadius: "4px",
              fontSize: "0.85rem",
            }}
          >
            <i className="mdi mdi-alert-circle text-danger" />
            <span className="text-danger">Process error detected</span>
          </div>
        )}

        <Row className="g-2 mb-3">
          <Col xs={6}>
            <div
              className="p-2"
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small">CPU</span>
                <span className="fw-bold" style={{ fontSize: "0.95rem" }}>
                  {(process.cpu || 0).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={process.cpu || 0}
                color={getCpuColor(process.cpu || 0)}
                style={{ height: "6px" }}
              />
            </div>
          </Col>

          <Col xs={6}>
            <div
              className="p-2"
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              <div className="text-muted small mb-1">Memory</div>
              <div className="fw-bold" style={{ fontSize: "0.95rem" }}>
                {formatMemory(process.memory)}
              </div>
            </div>
          </Col>

          <Col xs={6}>
            <div
              className="p-2"
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              <div className="text-muted small mb-1">Uptime</div>
              <div className="fw-bold" style={{ fontSize: "0.95rem" }}>
                {formatUptime(process.uptime)}
              </div>
            </div>
          </Col>

          <Col xs={6}>
            <div
              className="p-2"
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              <div className="text-muted small mb-1">Restarts</div>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold" style={{ fontSize: "0.95rem" }}>
                  {process.restarts || 0}
                </span>
                {highRestarts && (
                  <i
                    className="mdi mdi-alert-outline text-warning"
                    style={{ fontSize: "16px" }}
                  />
                )}
              </div>
            </div>
          </Col>
        </Row>

        {process.createdAt && (
          <div
            className="pt-2 text-muted small"
            style={{
              borderTop: "1px solid #e9ecef",
              fontSize: "0.75rem",
            }}
          >
            <i className="mdi mdi-clock-outline me-1" />
            {new Date(process.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ProcessCard;
