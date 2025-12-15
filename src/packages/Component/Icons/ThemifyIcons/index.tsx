import React, { useCallback, useState } from 'react';
import { Container, Row } from 'reactstrap';
import IconMarkUp from '../IconMarkUp';
import ThemifyCommon from './Common';
import { ThemifyIconData } from '@/Data/Icons/ThemifyIcons';
import Breadcrumbs from '@/CommonComponents/BreadCrumb';
import { ThemifyIcon } from '@/Constant';

const ThemifyIcons = () => {
  const [iTag, setITag] = useState<string | object>('');
  const [icon, setIcon] = useState<string | object>('');

  const callback = useCallback((tag: string) => {
    setITag({
      iTag: '<i className= "' + tag + '"></i>',
    });
    setIcon({
      icon: '' + tag + ' fa-2x',
    });
  }, []);
  return (
    <>
      <Breadcrumbs title={ThemifyIcon} parent='Icons' mainTitle={ThemifyIcon} />
      <Container fluid>
        {ThemifyIconData.map((item, i) => {
          return (
            <Row key={i}>
              <ThemifyCommon iconType={item.data} title={item.title} parentCallback={callback} />
            </Row>
          );
        })}
      </Container>
      <IconMarkUp iTag={iTag} icons={icon} />
    </>
  );
};

export default ThemifyIcons;
