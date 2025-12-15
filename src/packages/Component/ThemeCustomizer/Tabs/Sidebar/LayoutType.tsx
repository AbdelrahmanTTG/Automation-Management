import React, { Fragment } from 'react';

import CommenUL from './CommenUL';
import { Badge, ListGroup, ListGroupItem } from 'reactstrap';
import ConfigDB from '@/packages/config/ThemeConfig';

const handleSideBarLayout = (remove: string[], add: string) => {
  ConfigDB.data.settings.layout_type = add;
  const layoutElement = document.getElementById('mainLayout');
  layoutElement?.classList.remove(remove[0]);
  layoutElement?.classList.remove(remove[1]);
  layoutElement?.classList.add(add);
  document.dir = add;
};

const LayoutType = () => {
  return (
    <Fragment>
      <h6>Layout Type</h6>
      <ListGroup className='main-layout layout-grid flex-row'>
        <ListGroupItem>
          <div className='header bg-light'>
            <CommenUL />
          </div>
          <div className='body'>
            <ListGroup>
              <ListGroupItem className='bg-light sidebar'></ListGroupItem>
              <ListGroupItem className='bg-light body'>
                <Badge
                  onClick={() => {
                    handleSideBarLayout(['rtl', 'box-layout'], 'ltr');
                  }}
                  color='primary'>
                  LTR
                </Badge>
              </ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
        <ListGroupItem>
          <div className='header bg-light'>
            <CommenUL />
          </div>
          <div className='body'>
            <ListGroup>
              <ListGroupItem className='bg-light body'>
                <Badge
                  onClick={() => {
                    handleSideBarLayout(['ltr', 'box-layout'], 'rtl');
                  }}
                  color='primary'>
                  RTL
                </Badge>
              </ListGroupItem>
              <ListGroupItem className='bg-light sidebar'></ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
        <ListGroupItem>
          <div className='header bg-light'>
            <CommenUL />
          </div>
          <div className='body'>
            <ListGroup>
              <ListGroupItem className='bg-light sidebar'></ListGroupItem>
              <ListGroupItem className='bg-light body'>
                <Badge
                  color='primary'
                  onClick={() => {
                    handleSideBarLayout(['ltr', 'rtl'], 'box-layout');
                  }}>
                  Box
                </Badge>
              </ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
      </ListGroup>
    </Fragment>
  );
};

export default LayoutType;
