'use client';

import { Container, Row, Col } from 'reactstrap';
import React, { Fragment, useState, useCallback, useEffect } from "react";
import Left from "@/app/welocalize/Component/liftBar";


const Dashboard = () => {
  // const [logs, setLogs] = useState<string[]>([]);

  // useEffect(() => {
  //   const es = new EventSource(
  //     `/api/automation/stream?process=Welocalize_3`
  //   );

  //   es.onmessage = (event) => {
  //     const data = JSON.parse(event.data);
  //     setLogs((prev) => [...prev, data.log]);
  //   };

  //   es.onerror = () => {
  //     es.close();
  //   };

  //   return () => {
  //     es.close();
  //   };
  // }, []);
  return (
    <Container fluid={true} className='dashboard-default-sec'>
   <div className="email-wrap bookmark-wrap">
          <Row>
            <Left />
          </Row>
           {/* <pre style={{
      background: "#000",
      color: "#0f0",
      height: 400,
      overflow: "auto",
      padding: 10
    }}>
      {logs.join("")}
    </pre> */}
        </div>
    </Container>
  );
};

export default Dashboard;
