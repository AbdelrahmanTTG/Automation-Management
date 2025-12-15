import { FeatherIconsData } from '@/Data/Icons/FeatherIcons';
import React, { useState } from 'react';
import { Card, CardBody, Col, Container, Media, Row } from 'reactstrap';
import IconMarkup from '../IconMarkUp';
import Breadcrumbs from '@/CommonComponents/BreadCrumb';
import CardHeaderCommon from '@/CommonComponents/CardHeaderCommon';
import { FeatherIcon } from '@/Constant';

const FeatherIcons = () => {
  const [iTag, setITag] = useState<string | object>('');
  const [featherIcon, setFeatherIcon] = useState<string | object>('');
  const getITag = (tag: string) => {
    setITag({
      iTag: '<i data-feather="' + tag + '"></i>',
    });
    setFeatherIcon({
      featherIcon: tag,
    });
  };
  const featherIcons = require('feather-icons');

  return (
    <>
      <Breadcrumbs parent='Icons' title='FeatherIcon' mainTitle='FeatherIcon' />
      <>
        <Container fluid>
          <Row>
            <Col sm='12'>
              <Card>
                <CardHeaderCommon title={FeatherIcon} />
                <CardBody>
                  <Row className='icon-lists feather-icons'>
                    {FeatherIconsData.map((item, i) => (
                      <Col xs='12' sm='6' xl='4' key={i} onClick={() => getITag(item)}>
                        <Media className='d-flex'>
                          <div dangerouslySetInnerHTML={{ __html: featherIcons.icons[item].toSvg(item) }} />
                          <Media body className='flex-grow-1 align-self-center'>
                            <h6 className='mt-0'>{item}</h6>
                          </Media>
                        </Media>
                      </Col>
                    ))}
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
        <IconMarkup iTag={iTag} icons={featherIcon} />
      </>
    </>
  );
};

export default FeatherIcons;
