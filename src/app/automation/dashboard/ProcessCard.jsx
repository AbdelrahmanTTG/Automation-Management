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
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
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
        {/* Header */}
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

        {/* Error Alert */}
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

        {/* Metrics Grid */}
        <Row className="g-2 mb-3">
          {/* CPU */}
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

          {/* Memory */}
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

          {/* Uptime */}
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

          {/* Restarts */}
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

        {/* Footer */}
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
