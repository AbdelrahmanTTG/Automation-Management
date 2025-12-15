import Breadcrumbs from '@/CommonComponents/BreadCrumb';
import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
import { WeatherIcon, WhetherIconsWithAnimations } from '@/Constant';
import { WeatherIconData } from '@/Data/Icons/WeatherIcons';
import React from 'react';
import { Card, CardBody, Col, Container, Row } from 'reactstrap';

const WeatherIcons = () => {
  return (
    <>
      <Breadcrumbs title={WeatherIcon} parent='Icons' mainTitle={WeatherIcon} />
      <Container fluid>
        <Row>
          <Col sm='12'>
            <Card>
              <CardHeaderCommon title={WhetherIconsWithAnimations} />
              <CardBody>
                <Row className='icon-lists whether-icon'>
                  {WeatherIconData.map((icon, i) => (
                    <Col xs='4' lg='2' key={i}>
                      {icon.icon}
                    </Col>
                  ))}
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default WeatherIcons;
