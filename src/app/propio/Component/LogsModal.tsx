import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Modal, ModalBody, ModalHeader, Button } from 'reactstrap';

interface LogsModalProps {
  isOpen: boolean;
  toggler: () => void;
  botName: string;
  processName: string;
}

const LogsModal: React.FC<LogsModalProps> = ({
  isOpen,
  toggler,
  botName,
  processName,
}) => {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const fetchToken = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/automation/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': processName || 'default-user',
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setError('');
        return data.token;
      } else {
        throw new Error('Token fetch failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch token';
      setError(errorMsg);
      console.error('Failed to fetch token:', err);
      return null;
    }
  }, [processName]);

  const push = useCallback((text: string, className: string = '') => {
    const el = logRef.current;
    if (!el) return;

    const line = document.createElement('div');
    line.textContent = text;
    if (className) line.className = className;
    el.appendChild(line);

    if (el.children.length > 1000) {
      el.removeChild(el.firstChild!);
    }

    el.scrollTop = el.scrollHeight;
  }, []);

  const clearLogs = useCallback(() => {
    const el = logRef.current;
    if (el) {
      el.innerHTML = '';
    }
  }, []);

  const connectSSE = useCallback(
    (authToken: string) => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      try {
        const url = new URL('/api/automation/stream', window.location.origin);
        url.searchParams.set('proc', processName);
        url.searchParams.set('token', authToken);

        const es = new EventSource(url.toString(), { withCredentials: true });
        esRef.current = es;

        es.onopen = () => {
          setConnected(true);
          setError('');
          setReconnectAttempts(0);
          push('[System] Connected to log stream', 'text-success');
        };

        es.onerror = () => {
          setConnected(false);
          
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            push(`[System] Connection lost. Reconnecting... (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`, 'text-warning');
            
            reconnectTimerRef.current = setTimeout(() => {
              setReconnectAttempts((prev) => prev + 1);
              fetchToken().then((newToken) => {
                if (newToken && isOpen) {
                  connectSSE(newToken);
                }
              });
            }, RECONNECT_DELAY);
          } else {
            setError('Maximum reconnection attempts reached');
            push('[System] Connection failed. Please close and reopen.', 'text-danger');
          }
        };

        es.addEventListener('hello', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            push(`[Connected] Process: ${data.process || processName}`, 'text-success');
          } catch {
            push(`[Connected] ${ev.data}`, 'text-success');
          }
        });

        es.addEventListener('status', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            push(`[Status] ${data.status || ev.data}`, 'text-info');
          } catch {
            push(`[Status] ${ev.data}`, 'text-info');
          }
        });

        es.addEventListener('log', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            push(data.line || ev.data);
          } catch {
            push(ev.data);
          }
        });

        es.addEventListener('error', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            push(`[Error] ${data.line || ev.data}`, 'text-danger');
          } catch {
            push(`[Error] ${ev.data}`, 'text-danger');
          }
        });

        es.addEventListener('progress', (ev) => {
          try {
            const data = JSON.parse(ev.data);
            const { progress, name } = data;
            push(`[Progress: ${name || processName}] ${progress}%`, 'text-warning');
          } catch {
            push(`[Progress] ${ev.data}`, 'text-warning');
          }
        });
      } catch (err) {
        console.error('SSE connection error:', err);
        setError('Failed to establish connection');
        setConnected(false);
      }
    },
    [processName, push, reconnectAttempts, fetchToken, isOpen]
  );

  useEffect(() => {
    if (!isOpen || !processName) return;

    fetchToken().then((authToken) => {
      if (authToken) {
        connectSSE(authToken);
      }
    });

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(false);
      setError('');
      setReconnectAttempts(0);
    };
  }, [isOpen, processName, fetchToken, connectSSE]);

  const handleClose = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setConnected(false);
    setError('');
    setReconnectAttempts(0);
    toggler();
  };

  const handleReconnect = () => {
    setReconnectAttempts(0);
    clearLogs();
    fetchToken().then((authToken) => {
      if (authToken) {
        connectSSE(authToken);
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={handleClose}
      size="lg"
      backdrop="static"
      centered
    >
      <ModalHeader toggle={handleClose}>
        <div className="d-flex align-items-center gap-3 w-100">
          <span>{botName} - Live Logs</span>
          <span
            className={`badge ${
              connected ? 'bg-success' : error ? 'bg-danger' : 'bg-secondary'
            }`}
          >
            {connected ? 'Connected' : error ? 'Error' : 'Disconnected'}
          </span>
          <div className="ms-auto">
            <Button
              color="secondary"
              size="sm"
              onClick={clearLogs}
              className="me-2"
            >
              <i className="fa fa-eraser me-1"></i>
              Clear
            </Button>
            <Button
              color="primary"
              size="sm"
              onClick={handleReconnect}
              disabled={connected}
            >
              <i className="fa fa-refresh me-1"></i>
              Reconnect
            </Button>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            <i className="fa fa-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}
        <div
          ref={logRef}
          style={{
            border: '1px solid #ddd',
            padding: '12px',
            height: '500px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: '4px',
            lineHeight: '1.5',
          }}
        />
      </ModalBody>
    </Modal>
  );
};

export default LogsModal;