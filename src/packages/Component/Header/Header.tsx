'use client';
import React, { useEffect } from 'react';
import { Row } from 'reactstrap';
import LeftHeader from './LeftHeader';
import RightHeader from './RightHeader';
// import SearchBar from './Searchbar';

const Header = () => {
  useEffect(() => {
    window.addEventListener("resize", () => {
      if (window.innerWidth < 992) {
        document.getElementById("page-main-header")?.classList.add("close_icon");
        document.getElementById("page-main-nav")?.classList.add("close_icon");
      } else {
        document.getElementById("page-main-header")?.classList.remove("close_icon");
        document.getElementById("page-main-nav")?.classList.remove("close_icon");
      }
    });
  }, []);

  return (
    <div className="page-main-header" id="page-main-header">
      <Row className='main-header-right m-0'>
        <LeftHeader />
        {/* <SearchBar /> */}
        <RightHeader />        
      </Row>
    </div>
  );
};

export default Header;
