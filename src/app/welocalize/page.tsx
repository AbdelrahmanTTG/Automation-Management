'use client';

import { Container, Row, Col } from 'reactstrap';
import React, { Fragment, useState, useCallback, useEffect } from "react";
import Left from "@/app/welocalize/Component/liftBar";

const Dashboard = () => {
  
  return (
    <Container fluid={true} className='dashboard-default-sec'>
   <div className="email-wrap bookmark-wrap">
          <Row>
            <Left />
          </Row>
          
        </div>
    </Container>
  );
};

export default Dashboard;

