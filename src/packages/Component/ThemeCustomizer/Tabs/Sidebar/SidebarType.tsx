'use client';
import { handleSidebarType } from '@/packages/Redux/Slices/themeCostomizer';
import ConfigDB from '@/packages/config/ThemeConfig';
import { Fragment } from 'react';
import { useDispatch } from 'react-redux';
import { ListGroup, ListGroupItem } from 'reactstrap';
import CommenUL from './CommenUL';

const SidebarType = () => {
  const dispatch = useDispatch();

  const handleSidebar = (type: string) => {
    ConfigDB.data.settings.sidebar.type = type;
    dispatch(handleSidebarType(type));
  };
  return (
    <Fragment>
      <h6>Sidebar Type</h6>
      <ListGroup className='sidebar-type layout-grid'>
        <ListGroupItem className='normal-sidebar' onClick={() => handleSidebar('horizontal-wrapper')}>
          <div className='header bg-light'>
            <CommenUL />
          </div>
          <div className='body'>
            <ListGroup className='flex-row'>
              <ListGroupItem className='bg-dark sidebar'></ListGroupItem>
              <ListGroupItem className='bg-light body'></ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
        <ListGroupItem dataattr='compact-sidebar' onClick={() => handleSidebar('compact-wrapper')}>
          <div className='header bg-light'>
            <CommenUL />
          </div>
          <div className='body'>
            <ListGroup className='flex-row'>
              <ListGroupItem className='bg-dark sidebar compact'></ListGroupItem>
              <ListGroupItem className='bg-light body'></ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
      </ListGroup>
    </Fragment>
  );
};

export default SidebarType;
