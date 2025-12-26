import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
// import { IconsCommonProps } from '@/Type/SideBarType';
import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

const ThemifyCommon = ({ iconType, title, parentCallback }: IconsCommonProps) => {
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
              {iconType.map((icon, i) => {
                return (
                  <Col sm='6' lg='4' key={i} onClick={() => getITag(icon)}>
                    <i className={`${icon}`}></i> {icon}
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

export default ThemifyCommon;
