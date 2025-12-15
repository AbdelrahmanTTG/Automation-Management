import React, { Fragment, useContext, useEffect } from 'react';
import ConfigDB from '@/packages/config/ThemeConfig';
import { ListGroup, ListGroupItem } from 'reactstrap';
import Image from 'next/image';
import { AssetsImagePath } from '@/packages/Constant';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { handleLayoutType } from '@/packages/Redux/Slices/themeCostomizer';
import { NextResponse } from 'next/server';
import { NextURL } from 'next/dist/server/web/next-url';
import { url } from 'inspector';

const CheckLayout = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLayout = (layout: string) => {
    if (layout === undefined) {
      ConfigDB.data.settings.sidebar_setting = '';
    }
    ConfigDB.data.settings.sidebar_setting = layout;
    dispatch(handleLayoutType(layout));
    router.push(`?layout=${layout}`);
  };

  return (
    <Fragment>
      <ListGroup className='sidebar-type layout-grid layout-types'>
        <ListGroupItem dataattr='defaul-layout'>
          <div
            className='layout-img'
            onClick={() => {
              handleLayout('default-sidebar');
            }}>
            <Image height={265} width={197} className='img-fluid' src={`${AssetsImagePath}/landing/demo/1.jpg`} alt='' />
            <h6>Default layout</h6>
          </div>
        </ListGroupItem>
        <ListGroupItem dataattr='compact-layout'>
          <div
            className='layout-img'
            onClick={() => {
              handleLayout('compact-sidebar');
            }}>
            <Image className='img-fluid' height={265} width={197} src={`${AssetsImagePath}/landing/demo/2.jpg`} alt='' />
            <h6>Compact layout</h6>
          </div>
        </ListGroupItem>
        <ListGroupItem dataattr='modern-layout'>
          <div
            className='layout-img'
            onClick={() => {
              handleLayout('modern-sidebar');
            }}>
            <Image height={265} width={197} className='img-fluid' src={`${AssetsImagePath}/landing/demo/3.jpg`} alt='' />
            <h6>Modern layout</h6>
          </div>
        </ListGroupItem>
      </ListGroup>
    </Fragment>
  );
};

export default CheckLayout;
