import React from 'react';
import { Col } from 'reactstrap';
import MoonLight from './MoonLight';
// import Notifications from './Notifications';
// import MessageDrop from './MessageDrop';
import LogOutClass from './LogOutClass';
import MaximizeScreen from './Maximize';
// import LanguageClass from './Language';
import { MoreHorizontal } from 'react-feather';
import { RootState, useAppDispatch } from '@/packages/Redux/ReduxStore';
import { setHeaderToggle } from '@/packages/Redux/Slices/HeaderSlice';
import { useSelector } from 'react-redux';

const RightHeader = () => {
  const {headerToggle} = useSelector((state:RootState)=>state.headerSlice)
  const dispatch = useAppDispatch()
  const headerToggleHandler=()=>{
    dispatch(setHeaderToggle())
  }

  return (
    <>
    <Col className='nav-right pull-right right-menu p-0'>
      <ul className={`nav-menus ${headerToggle? "open" : ""}`}>
        <MaximizeScreen />
        {/* <LanguageClass /> */}
        {/* <Bookmarks /> */}
        {/* <Notifications /> */}
        <MoonLight />
        {/* <MessageDrop /> */}
        <LogOutClass />
      </ul>
    </Col>
    <div className="d-lg-none mobile-toggle pull-right w-auto" onClick={headerToggleHandler}><MoreHorizontal /></div>
    </>
  );
};

export default RightHeader;
