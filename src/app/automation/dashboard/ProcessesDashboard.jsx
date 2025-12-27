"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Row,
  Col,
  Card,
  CardBody,
  Badge,
  Spinner,
  Alert,
  ButtonGroup,
  Button,
  Table,
  Progress,
} from "reactstrap";
import ProcessCard from "./ProcessCard";

const ProcessesDashboard = () => {
  const [processes, setProcesses] = useState([]);
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [filter, setFilter] = useState("all");
  const [systemStats, setSystemStats] = useState({
    totalCpu: 0,
    totalMemory: 0,
    totalMemoryAvailable: 0,
    memoryPercent: 0,
    numCpus: 0,
  });
  const esRef = useRef(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/automation/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setToken(data.token);
        } else {
          setError("Failed to authenticate");
        }
      } catch (error) {
        console.error("Failed to fetch token:", error);
        setError("Connection error");
      }
    };

    fetchToken();
  }, []);

  useEffect(() => {
    if (!token) return;

    const url = new URL(
      "/api/automation/processes-stream",
      window.location.origin
    );
    url.searchParams.set("token", token);

    const es = new EventSource(url.toString(), { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost - Reconnecting...");
    };

    es.addEventListener("hello", (ev) => {
      console.log("Connected:", ev.data);
    });

    es.addEventListener("processes", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const systemProcess = data.find((p) => p.name === "__system__");
        const regularProcesses = data.filter((p) => p.name !== "__system__");

        if (systemProcess) {
          setSystemStats({
            totalCpu: systemProcess.cpu || 0,
            totalMemory: systemProcess.memory || 0,
            totalMemoryAvailable: systemProcess.totalMemoryAvailable || 0,
            memoryPercent: systemProcess.memoryPercent || 0,
            numCpus: systemProcess.numCpus || 0,
          });
        }

        setProcesses(regularProcesses);
      } catch (err) {
        console.error("Parse error:", err);
      }
    });

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnected(false);
    };
  }, [token]);

  const filteredProcesses = processes.filter((proc) => {
    if (filter === "online") return proc.status === "online";
    if (filter === "stopped") return proc.status === "stopped";
    if (filter === "errored") return proc.status === "errored";
    if (filter === "other")
      return !["online", "stopped", "errored"].includes(proc.status);
    return true;
  });

  const stats = {
    total: processes.length,
    online: processes.filter((p) => p.status === "online").length,
    stopped: processes.filter((p) => p.status === "stopped").length,
    errored: processes.filter((p) => p.status === "errored").length,
    other: processes.filter(
      (p) => !["online", "stopped", "errored"].includes(p.status)
    ).length,
  };

  const formatMemory = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
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

  return (
    <div
      style={{
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <Card className="shadow-sm mb-4" style={{ border: "none" }}>
        <CardBody className="py-3">
          <Row className="align-items-center">
            <Col md={4}>
              <h4 className="mb-0 fw-bold" style={{ fontSize: "1.25rem" }}>
                Process Monitor
              </h4>
            </Col>
            <Col md={8}>
              <div className="d-flex align-items-center justify-content-md-end gap-3">
                <div className="d-flex align-items-center gap-2">
                  {connected ? (
                    <>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "#28a745",
                        }}
                      />
                      <span className="text-muted small">Live</span>
                    </>
                  ) : (
                    <>
                      <Spinner size="sm" color="secondary" />
                      <span className="text-muted small">Connecting...</span>
                    </>
                  )}
                </div>

                <ButtonGroup size="sm">
                  <Button
                    color={viewMode === "cards" ? "dark" : "light"}
                    onClick={() => setViewMode("cards")}
                    style={{ border: "1px solid #dee2e6" }}
                  >
                    <i className="mdi mdi-view-grid" />
                  </Button>
                  <Button
                    color={viewMode === "table" ? "dark" : "light"}
                    onClick={() => setViewMode("table")}
                    style={{ border: "1px solid #dee2e6" }}
                  >
                    <i className="mdi mdi-view-list" />
                  </Button>
                </ButtonGroup>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {error && (
        <Alert
          color="warning"
          className="shadow-sm mb-4"
          style={{ border: "none" }}
        >
          <i className="mdi mdi-alert-circle-outline me-2" />
          {error}
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small mb-1">Total Processes</div>
                  <h3 className="mb-0 fw-bold">{stats.total}</h3>
                </div>
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  <i
                    className="mdi mdi-apps"
                    style={{ fontSize: "24px", color: "#6c757d" }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small mb-1">Online</div>
                  <h3 className="mb-0 fw-bold text-success">{stats.online}</h3>
                </div>
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#d4edda",
                  }}
                >
                  <i
                    className="mdi mdi-check-circle"
                    style={{ fontSize: "24px", color: "#28a745" }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small mb-1">Stopped</div>
                  <h3 className="mb-0 fw-bold">{stats.stopped}</h3>
                </div>
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#e2e3e5",
                  }}
                >
                  <i
                    className="mdi mdi-stop-circle"
                    style={{ fontSize: "24px", color: "#6c757d" }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small mb-1">Errored</div>
                  <h3 className="mb-0 fw-bold text-danger">{stats.errored}</h3>
                </div>
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    backgroundColor: "#f8d7da",
                  }}
                >
                  <i
                    className="mdi mdi-alert-circle"
                    style={{ fontSize: "24px", color: "#dc3545" }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small">
                  Automation Processes CPU Usage
                </span>
                <span className="fw-bold">
                  {systemStats.totalCpu.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={systemStats.totalCpu}
                color={getCpuColor(systemStats.totalCpu)}
                style={{ height: "8px" }}
              />
              <div className="text-muted small mt-1">
                {systemStats.numCpus > 0 &&
                  `${systemStats.numCpus} CPU cores available`}
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm h-100" style={{ border: "none" }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small">
                  Automation Processes Memory Usage
                </span>
                <span className="fw-bold">
                  {formatMemory(systemStats.totalMemory)} /{" "}
                  {formatMemory(systemStats.totalMemoryAvailable)}
                </span>
              </div>
              <Progress
                value={systemStats.memoryPercent}
                color={getCpuColor(systemStats.memoryPercent)}
                style={{ height: "8px" }}
              />
              <div className="text-muted small mt-1">
                {systemStats.memoryPercent.toFixed(1)}% of total server memory
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm mb-4" style={{ border: "none" }}>
        <CardBody className="p-3">
          <ButtonGroup size="sm">
            <Button
              color={filter === "all" ? "dark" : "light"}
              onClick={() => setFilter("all")}
              style={{ border: "1px solid #dee2e6" }}
            >
              All{" "}
              <Badge color="secondary" className="ms-1">
                {stats.total}
              </Badge>
            </Button>
            <Button
              color={filter === "online" ? "success" : "light"}
              onClick={() => setFilter("online")}
              style={{ border: "1px solid #dee2e6" }}
            >
              Online{" "}
              <Badge color="secondary" className="ms-1">
                {stats.online}
              </Badge>
            </Button>
            <Button
              color={filter === "stopped" ? "secondary" : "light"}
              onClick={() => setFilter("stopped")}
              style={{ border: "1px solid #dee2e6" }}
            >
              Stopped{" "}
              <Badge color="secondary" className="ms-1">
                {stats.stopped}
              </Badge>
            </Button>
            <Button
              color={filter === "errored" ? "danger" : "light"}
              onClick={() => setFilter("errored")}
              style={{ border: "1px solid #dee2e6" }}
            >
              Errored{" "}
              <Badge color="secondary" className="ms-1">
                {stats.errored}
              </Badge>
            </Button>
            {stats.other > 0 && (
              <Button
                color={filter === "other" ? "warning" : "light"}
                onClick={() => setFilter("other")}
                style={{ border: "1px solid #dee2e6" }}
              >
                Other{" "}
                <Badge color="secondary" className="ms-1">
                  {stats.other}
                </Badge>
              </Button>
            )}
          </ButtonGroup>
        </CardBody>
      </Card>

      {processes.length === 0 && !error ? (
        <Card className="shadow-sm" style={{ border: "none" }}>
          <CardBody>
            <div className="text-center py-5">
              <Spinner
                color="primary"
                style={{ width: "3rem", height: "3rem" }}
              />
              <p className="mt-3 text-muted">Loading processes...</p>
            </div>
          </CardBody>
        </Card>
      ) : viewMode === "cards" ? (
        <Row className="g-3">
          {filteredProcesses.map((proc) => (
            <Col key={proc.pm_id} xl={3} lg={4} md={6}>
              <ProcessCard process={proc} />
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="shadow-sm" style={{ border: "none" }}>
          <CardBody className="p-0">
            <div style={{ overflowX: "auto" }}>
              <Table className="mb-0" hover>
                <thead style={{ backgroundColor: "#f8f9fa" }}>
                  <tr>
                    <th className="border-0 py-3 px-3 small text-muted">
                      Process
                    </th>
                    <th className="border-0 py-3 px-3 small text-muted text-center">
                      Status
                    </th>
                    <th className="border-0 py-3 px-3 small text-muted text-end">
                      CPU
                    </th>
                    <th className="border-0 py-3 px-3 small text-muted text-end">
                      Memory
                    </th>
                    <th className="border-0 py-3 px-3 small text-muted text-center">
                      Uptime
                    </th>
                    <th className="border-0 py-3 px-3 small text-muted text-center">
                      Restarts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.map((proc) => (
                    <tr key={proc.pm_id}>
                      <td className="py-3 px-3">
                        <div className="fw-bold">{proc.name}</div>
                        <div className="text-muted small">
                          PID: {proc.pm_id}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge color={getStatusColor(proc.status)} pill>
                          {proc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-end">
                        <div className="fw-bold">
                          {(proc.cpu || 0).toFixed(1)}%
                        </div>
                        <Progress
                          value={proc.cpu || 0}
                          color={getCpuColor(proc.cpu || 0)}
                          style={{
                            height: "4px",
                            width: "60px",
                            marginLeft: "auto",
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 text-end">
                        <div className="fw-bold">
                          {formatMemory(proc.memoryUsed || proc.memory)}
                        </div>
                        <div className="text-muted small">
                          {formatMemory(proc.memory)} reserved
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-muted small">
                        {formatUptime(proc.uptime)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          color={
                            (proc.restarts || 0) > 5 ? "warning" : "secondary"
                          }
                        >
                          {proc.restarts || 0}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      {filteredProcesses.length === 0 && processes.length > 0 && (
        <Card className="shadow-sm" style={{ border: "none" }}>
          <CardBody>
            <div className="text-center py-5">
              <i
                className="mdi mdi-filter-remove"
                style={{ fontSize: "48px", color: "#6c757d" }}
              />
              <p className="text-muted mt-2 mb-0">
                No processes match the current filter
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default ProcessesDashboard;
