import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
// import { IconsCommonProps } from '@/Type/SideBarType';
import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

const FontAwesomeCommon = ({ iconType, title, parentCallback }: IconsCommonProps) => {
  const getITag = (tag: string) => {
    parentCallback(tag);
  };
  return (
    <>
      <Col sm='12'>
        <Card>
          <CardHeaderCommon title={title} />
          <CardBody>
            <Row className='icon-lists'>
              {iconType.map((icon: string, i: number) => {
                return (
                  <Col sm='6' md='4' xl='3' key={i} onClick={() => getITag(icon)}>
                    <i className={`fa fa-${icon}`}></i> {'fa fa-'}
                    {icon}
                  </Col>
                );
              })}
            </Row>
          </CardBody>
        </Card>
      </Col>
    </>
  );
};

export default FontAwesomeCommon;
