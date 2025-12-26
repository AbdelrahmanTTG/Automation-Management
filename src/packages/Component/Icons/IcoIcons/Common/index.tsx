import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
// import { IconsCommonProps } from '@/Type/SideBarType';
import React from 'react';
import { Card, CardBody, Col, Row } from 'reactstrap';

const IcoIconsCommon = ({ title, iconType, parentCallback }: IconsCommonProps) => {
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
              {iconType.map((item, i) => {
                return (
                  <Col sm='6' xs='12' lg='4' key={i} onClick={() => getITag(item)}>
                    <i className={`icofont icofont-${item}`}></i> {item}
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

export default IcoIconsCommon;
