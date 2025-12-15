import { FlagIcons, Icons } from '@/Constant';
import { FlagIconData } from '@/Data/Icons/FlagIcons';
import React, { useState } from 'react';
import { Card, CardBody, Col, Container, Media, Row } from 'reactstrap';
import IconMarkUp from '../IconMarkUp';
import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
import Breadcrumbs from '@/CommonComponents/BreadCrumb';

const FlagIcon = () => {
  const [iTag, setITag] = useState<string | object>('');
  const [icon, setIcon] = useState<string | object>('');

  const getITag = (tag: string) => {
    setITag({
      iTag: '<i className="flag-icon flag-icon-' + tag + '"></i>',
    });
    setIcon({
      icon: 'flag-icon flag-icon-' + tag + ' fa-2x',
    });
  };
  return (
    <>
      <Breadcrumbs title={FlagIcons} parent={Icons} mainTitle={FlagIcons} />
      <Container fluid>
        <Row>
          <Col sm='12'>
            <Card>
              <CardHeaderCommon title={FlagIcons} />
              <CardBody>
                <Row className='icon-lists flag-icons'>
                  {FlagIconData.map((icon, i) => {
                    return (
                      <Col sm='6' xs='12' xl='4' key={i} onClick={(e) => getITag(icon.abbrivation)}>
                        <Media>
                          <i className={`flag-icon flag-icon-${icon.abbrivation}`}></i>
                          <Media body className='align-self-center'>
                            <h5>{icon.abbrivation}</h5>
                            <h6 className='mt-0'>{icon.name}</h6>
                          </Media>
                        </Media>
                      </Col>
                    );
                  })}
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
      <IconMarkUp iTag={iTag} icons={icon} />
    </>
  );
};

export default FlagIcon;
