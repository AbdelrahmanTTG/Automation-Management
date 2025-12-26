import React from 'react';
import { Container } from 'reactstrap';
import ProcessesDashboard from './ProcessesDashboard';
// import ProcessesMonitor from './ProcessesMonitor';

const DashboardPage = () => {
  return (
    <div className="page-content">
      <Container fluid>
        <ProcessesDashboard />
        
        {/* <ProcessesMonitor /> */}
      </Container>
    </div>
  );
};

export default DashboardPage;