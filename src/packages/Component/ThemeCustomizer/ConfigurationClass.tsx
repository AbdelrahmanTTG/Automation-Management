"use client";
import React, { Fragment } from 'react';
import { Container, Modal, ModalBody, ModalHeader, ModalFooter, Row, Button } from 'reactstrap';
import { Configuration, CopyText, Cancel } from '../../Constant';
import { ConfigDB } from '@/packages/config/ThemeConfig';
import copy from 'copy-to-clipboard';
import { toast } from 'react-toastify';

const ConfigurationClass = ({ toggle, modal }: any) => {
  const configDB = ConfigDB.data;

  const handleCopy = () => {
    copy(JSON.stringify(configDB));
    toast.success('Code Copied to clipboard!', {
      position: toast.POSITION.BOTTOM_RIGHT,
    });
  };

  return (
    <Fragment>
      <Modal isOpen={modal} toggle={toggle} className='modal-body' centered={true}>
        <ModalHeader toggle={toggle}>{Configuration}</ModalHeader>
        <ModalBody>
          <Container fluid={true} className='bd-example-row'>
            <Row>
              <p>{'To replace our design with your desired theme. Please do configuration as mentioned.'}</p>
              <p>
                <b>{'Path : data > customizer > config.jsx '}</b>
              </p>
            </Row>
            <pre>
              <code>
                <div>{'export class ConfigDB {'}</div>
                <div>{'static data = {'}</div>
                <div>{'settings: {'}</div>
                <div>{`layout_type: '${configDB.settings.layout_type}',`}</div>
                <div>{'sidebar: {'}</div>
                <div>{`type: '${configDB.settings.sidebar.type}'`}</div>
                <div>{'},'}</div>
                <div>{`sidebar_setting: '${configDB.settings.sidebar_setting}'`}</div>
                <div>{'},'}</div>
                <div>{'color: {'}</div>
                <div>{`primary_color: '${configDB.color.primary_color}',`}</div>
                <div>{`secondary_color: '${configDB.color.secondary_color}',`}</div>
                <div>{`mix_background_layout: '${configDB.color.mix_background_layout}'`}</div>
                <div>{'},'}</div>
                <div>{'};'}</div>
              </code>
            </pre>
          </Container>
        </ModalBody>
        <ModalFooter>
          <Button color='primary' className='notification' onClick={handleCopy}>
            {CopyText}
          </Button>
          <Button color='secondary' onClick={toggle}>
            {Cancel}
          </Button>
        </ModalFooter>
      </Modal>
    </Fragment>
  );
};

export default ConfigurationClass;
