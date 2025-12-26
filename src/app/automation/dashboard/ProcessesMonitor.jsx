"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  Table,
  Progress,
  Spinner,
  Alert,
} from "reactstrap";

const ProcessesMonitor = () => {
  const [processes, setProcesses] = useState([]);
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/automation/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
      setError("Connection lost");
    };

    es.addEventListener("hello", (ev) => {
      console.log("Connected:", ev.data);
    });

    es.addEventListener("processes", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setProcesses(data);
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

  const formatMemory = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatUptime = (ms) => {
    if (!ms) return "Just started";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      online: { color: "success", text: "Online" },
      stopping: { color: "warning", text: "Stopping" },
      stopped: { color: "danger", text: "Stopped" },
      launching: { color: "info", text: "Launching" },
      errored: { color: "danger", text: "Error" },
      "one-launch-status": { color: "secondary", text: "One Launch" },
    };

    const statusInfo = statusMap[status] || {
      color: "secondary",
      text: status,
    };
    return <Badge color={statusInfo.color}>{statusInfo.text}</Badge>;
  };

  const getCpuColor = (cpu) => {
    if (cpu >= 80) return "danger";
    if (cpu >= 50) return "warning";
    return "success";
  };

  return (
    <Card>
      <CardHeader className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Process Monitor</h5>
        <div className="d-flex align-items-center gap-2">
          {connected ? (
            <>
              <Badge color="success">Connected</Badge>
              <i
                className="mdi mdi-circle text-success"
                style={{ fontSize: "12px" }}
              ></i>
            </>
          ) : (
            <>
              <Spinner size="sm" color="secondary" />
              <Badge color="secondary">Connecting...</Badge>
            </>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {error && (
          <Alert color="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {processes.length === 0 && !error ? (
          <div className="text-center py-5">
            <Spinner color="primary" />
            <p className="mt-3 text-muted">Loading processes...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>Uptime</th>
                  <th>Restarts</th>
                  <th>Started At</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((proc) => (
                  <tr key={proc.pm_id}>
                    <td>
                      <strong>{proc.name}</strong>
                      <br />
                      <small className="text-muted">ID: {proc.pm_id}</small>
                    </td>
                    <td>{getStatusBadge(proc.status)}</td>
                    <td>
                      <div style={{ minWidth: "120px" }}>
                        <div className="d-flex justify-content-between mb-1">
                          <small>{proc.cpu.toFixed(1)}%</small>
                        </div>
                        <Progress
                          value={proc.cpu}
                          color={getCpuColor(proc.cpu)}
                          style={{ height: "8px" }}
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ minWidth: "120px" }}>
                        <small>{formatMemory(proc.memory)}</small>
                      </div>
                    </td>
                    <td>
                      <Badge color="info" pill>
                        {formatUptime(proc.uptime)}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        color={proc.restarts > 5 ? "warning" : "secondary"}
                      >
                        {proc.restarts}
                      </Badge>
                    </td>
                    <td>
                      <small>{formatDate(proc.createdAt)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {processes.length > 0 && (
          <div className="mt-3 d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Total Processes: <strong>{processes.length}</strong>
            </small>
            <small className="text-muted">
              Online:{" "}
              <strong className="text-success">
                {processes.filter((p) => p.status === "online").length}
              </strong>
            </small>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ProcessesMonitor;
