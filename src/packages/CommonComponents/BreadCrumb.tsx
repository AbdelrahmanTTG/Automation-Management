import React, { Fragment } from 'react';
import { Container, Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap';
import Link from 'next/link';
import { BreadCrumbType } from '@/Type/SideBarType';
import { useSelector } from 'react-redux';
import { RootState } from '@/Redux/ReduxStore';
import { Command, Inbox, Layers, MessageCircle, Star } from 'react-feather';
import { Checkout, Javascript } from '@/Constant';
type BreadCrumbType = {
  mainTitle?: string;
  parent?: string;
  title: string;
};
const Breadcrumbs = ({ mainTitle, parent, title }: BreadCrumbType) => {

  return (
    <Container fluid>
      <div className="page-header">
        <Row>
          <Col sm="6">
            <div className="page-header-left">
              <h3>{title}</h3>
              <Breadcrumb className="d-flex">
                <BreadcrumbItem>
                  <Link href={`/dashboard/default`}>Home</Link>
                </BreadcrumbItem>
                <BreadcrumbItem>{parent}</BreadcrumbItem>
                <BreadcrumbItem active>{title}</BreadcrumbItem>
              </Breadcrumb>
            </div>
          </Col>
          <Col sm="6">
            <div className="bookmark">
              <ul>
                <li><a href={Javascript}><Inbox /></a></li>
                <li><a href={Javascript}><MessageCircle /></a></li>
                <li><a href={Javascript}><Command /></a></li>
                <li><a href={Javascript}><Layers /></a></li>
                <li><a href={Javascript}><Star className="bookmark-search" /></a>
                <form className="form-inline search-form">
                    <div className="form-group form-control-search">
                      <input type="text" placeholder="Search.." />
                    </div>
                  </form>
                </li>
              </ul>
            </div>
          </Col>
        </Row>
      </div>
    </Container>
    // <Container fluid={true}>
    //   <div className='page-header'>
    //     <Row>
    //       <Col sm='6'>
    //         <h3>{mainTitle}</h3>
    //       </Col>
    //       <Col sm='6'>
    //         <ol className='breadcrumb'>
    //           <li className='breadcrumb-item'>
    //             <Link href={`/dashboard/default`}>Home</Link>
    //           </li>
    //           <li className='breadcrumb-item'>{parent}</li>
    //           <li className='breadcrumb-item active'>{title}</li>
    //         </ol>
    //       </Col>
    //     </Row>
    //   </div>
    // </Container>
  );
};

export default Breadcrumbs;
